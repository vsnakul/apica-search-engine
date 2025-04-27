package server

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/apache/arrow/go/arrow/memory"
	"github.com/apache/arrow/go/v13/arrow"
	"github.com/apache/arrow/go/v13/arrow/array"
	"github.com/apache/arrow/go/v13/parquet"
	"github.com/apache/arrow/go/v13/parquet/pqarrow"
	"github.com/sirupsen/logrus"
)

type Document struct {
	ID            string
	Message       string
	MessageRaw    string
	StructuredData string
	Tag           string
	Sender        string
	Groupings     string
	Event         string
	EventID       string
	Timestamp     int64
	Namespace     string
}

// SearchIndex represents our in-memory search engine
type SearchIndex struct {
	Documents    map[string]*Document         // Document storage
	InvertedIndex map[string]map[string]bool  // Term -> document IDs mapping
	mutex        sync.RWMutex                 // For concurrent access
}

// NewSearchIndex creates a new search index
func NewSearchIndex() *SearchIndex {
	return &SearchIndex{
		Documents:    make(map[string]*Document),
		InvertedIndex: make(map[string]map[string]bool),
	}
}

// IndexDocument adds a document to the search index
func (idx *SearchIndex) IndexDocument(doc *Document) {
	idx.mutex.Lock()
	defer idx.mutex.Unlock()

	// Store the document
	idx.Documents[doc.ID] = doc
	
	// Index the document terms
	terms := tokenize(doc.Message + " " + doc.Tag + " " + doc.Sender + " " + doc.Event)
	for _, term := range terms {
		if idx.InvertedIndex[term] == nil {
			idx.InvertedIndex[term] = make(map[string]bool)
		}
		idx.InvertedIndex[term][doc.ID] = true
	}
}

// Search performs a search on the index
func (idx *SearchIndex) Search(query string) ([]*Document, time.Duration) {
	startTime := time.Now()
	
	idx.mutex.RLock()
	defer idx.mutex.RUnlock()
	
	queryTerms := tokenize(query)
	if len(queryTerms) == 0 {
		return []*Document{}, time.Since(startTime)
	}
	
	// Find documents containing all query terms (AND logic)
	var matchingIDs map[string]bool
	
	// Start with the first term
	firstTerm := queryTerms[0]
	if idx.InvertedIndex[firstTerm] != nil {
		matchingIDs = make(map[string]bool)
		for id := range idx.InvertedIndex[firstTerm] {
			matchingIDs[id] = true
		}
	} else {
		return []*Document{}, time.Since(startTime)
	}
	
	// Intersect with remaining terms
	for _, term := range queryTerms[1:] {
		if idx.InvertedIndex[term] == nil {
			return []*Document{}, time.Since(startTime)
		}
		
		// Perform intersection
		for id := range matchingIDs {
			if !idx.InvertedIndex[term][id] {
				delete(matchingIDs, id)
			}
		}
		
		if len(matchingIDs) == 0 {
			return []*Document{}, time.Since(startTime)
		}
	}
	
	// Collect matching documents
	results := make([]*Document, 0, len(matchingIDs))
	for id := range matchingIDs {
		results = append(results, idx.Documents[id])
	}
	
	return results, time.Since(startTime)
}



var searchIndex *SearchIndex

// SearchResult represents the search results returned by the API
type SearchResult struct {
	Query         string      `json:"query"`
	TotalResults  int         `json:"totalResults"`
	SearchTimeMs  float64     `json:"searchTimeMs"`
	Results       []*Document `json:"results"`
}

const (
	maxFileWorkers  =  4 // Maximum number of files to process concurrently
	maxRowsPerBatch = 1000 // Number of rows to process in each batch
)

func processParquetFile(filePath string) error {
	f, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}
	defer f.Close()

	tbl, err := pqarrow.ReadTable(context.Background(), f, parquet.NewReaderProperties(memory.DefaultAllocator),
		pqarrow.ArrowReadProperties{}, memory.DefaultAllocator)
	if err != nil {
		return fmt.Errorf("failed to read table: %w", err)
	}

	// Process table with concurrent batches
	return processTableConcurrently(tbl)
}

func processTableConcurrently(tbl arrow.Table) error {
	// Get column indices (assuming schema has these fields)
	colIndices := make(map[string]int)
	for i := 0; i < int(tbl.NumCols()); i++ {
		colName := tbl.Column(i).Name()
		colIndices[colName] = i
	}

	// Calculate the number of batches
	totalRows := tbl.NumRows()
	numBatches := (totalRows + int64(maxRowsPerBatch) - 1) / int64(maxRowsPerBatch)

	// Use a WaitGroup to wait for all batches to complete
	var wg sync.WaitGroup
	wg.Add(int(numBatches))

	// Create a channel to control concurrency
	// This limits the number of goroutines running simultaneously
	semaphore := make(chan struct{}, 8) // Allow 8 concurrent batch processors

	// Use mutex to synchronize index access
	var indexMutex sync.Mutex

	// Process each batch in a separate goroutine
	for batchIdx := int64(0); batchIdx < numBatches; batchIdx++ {
		startRow := batchIdx * int64(maxRowsPerBatch)
		endRow := startRow + int64(maxRowsPerBatch)
		if endRow > totalRows {
			endRow = totalRows
		}

		// Acquire semaphore slot
		semaphore <- struct{}{}

		go func(start, end int64) {
			defer wg.Done()
			defer func() { <-semaphore }() // Release semaphore slot when done

			// Process rows in this batch
			processBatch(tbl, colIndices, start, end, &indexMutex)
		}(startRow, endRow)
	}

	// Wait for all batches to complete
	wg.Wait()
	return nil
}

func processBatch(tbl arrow.Table, colIndices map[string]int, startRow, endRow int64, indexMutex *sync.Mutex) {
	// Create functions to extract values safely
	getString := func(rowIdx int64, colName string) string {
		if colIdx, exists := colIndices[colName]; exists {
			col := tbl.Column(colIdx)
			if rowIdx < int64(col.Len()) {
				chunk := col.Data().Chunk(0)
				if chunk != nil {
					if strArr, ok := chunk.(*array.String); ok {
						return strArr.Value(int(rowIdx))
					}
				}
			}
		}
		return ""
	}

	getInt64 := func(rowIdx int64, colName string) int64 {
		if colIdx, exists := colIndices[colName]; exists {
			col := tbl.Column(colIdx)
			if rowIdx < int64(col.Len()) {
				chunk := col.Data().Chunk(0)
				if chunk != nil {
					if intArr, ok := chunk.(*array.Int64); ok && !intArr.IsNull(int(rowIdx)) {
						return intArr.Value(int(rowIdx))
					}
				}
			}
		}
		return 0
	}

	// Batch documents to reduce mutex contention
	batchDocs := make([]*Document, 0, endRow-startRow)

	// Process each row in this batch
	for rowIdx := startRow; rowIdx < endRow; rowIdx++ {
		doc := &Document{
			ID:             fmt.Sprintf("%d", rowIdx),
			Message:        getString(rowIdx, "Message"),
			MessageRaw:     getString(rowIdx, "MessageRaw"),
			StructuredData: getString(rowIdx, "StructuredData"),
			Tag:            getString(rowIdx, "Tag"),
			Sender:         getString(rowIdx, "Sender"),
			Groupings:      getString(rowIdx, "Groupings"),
			Event:          getString(rowIdx, "Event"),
			EventID:        getString(rowIdx, "EventId"),
			Timestamp:      getInt64(rowIdx, "NanoTimeStamp"),
			Namespace:      getString(rowIdx, "Namespace"),
		}

		batchDocs = append(batchDocs, doc)
	}

	// Lock once to add all documents in the batch
	indexMutex.Lock()
	for _, doc := range batchDocs {
		searchIndex.IndexDocument(doc)
	}
	indexMutex.Unlock()
}

func processParquetFiles(folderPath string,logger *logrus.Logger) error {
	// Check if the folder exists
	logger.Infof("Checking folder: %s\n", folderPath)
	info, err := os.Stat(folderPath)
	if err != nil {
		return fmt.Errorf("folder access error: %w", err)
	}
	if !info.IsDir() {
		return fmt.Errorf("path %s is not a directory", folderPath)
	}

	// Read all files in the directory
	files, err := os.ReadDir(folderPath)
	if err != nil {
		return fmt.Errorf("failed to read directory: %w", err)
	}

	// Create a channel to limit concurrent file processing
	semaphore := make(chan struct{}, maxFileWorkers)
	var wg sync.WaitGroup

	// Process each parquet file concurrently
	errChan := make(chan error, len(files))
	for _, file := range files {
		// Skip directories and non-parquet files
		if file.IsDir() {
			continue
		}

		wg.Add(1)
		go func(fileName string) {
			defer wg.Done()

			// Acquire semaphore (blocking if maxFileWorkers is reached)
			semaphore <- struct{}{}
			defer func() { <-semaphore }() // Release when done

			filePath := filepath.Join(folderPath, fileName)
			logger.Infof("Processing file: %s\n", filePath)

			if err := processParquetFile(filePath); err != nil {
				errChan <- fmt.Errorf("error processing %s: %w", filePath, err)
			}
		}(file.Name())
	}

	// Wait for all files to be processed
	wg.Wait()
	close(errChan)

	// Collect errors
	var errors []error
	for err := range errChan {
		errors = append(errors, err)
		fmt.Println(err)
	}

	if len(errors) > 0 {
		return fmt.Errorf("encountered %d errors during processing", len(errors))
	}
	return nil
}

// Helper function to tokenize text
func tokenize(text string) []string {
	// Simplistic tokenization for now
	text = strings.ToLower(text)
	// Replace non-alphanumeric with spaces
	// Split by whitespace
	return strings.Fields(text)
}