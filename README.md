# apica-search-engine

An extremely lightweight search engine built using Golang and React to search across Parquet data.



## 📚 Tech Stack:
- **Backend**: Golang
- **Frontend**: ReactJS
- **File Reading**: Apache Arrow (with pqarrow for Parquet file reading in Go)
- **Logging**: logrus
- **Concurrency**: Go routines + channels + WaitGroup + Mutex
- **File Handling**: os, filepath
- **In-memory Search Engine**: Custom built (with inverted index technique)
- **Data Structure**:
  - Document struct for representing a record.
  - SearchIndex struct for search operations.
- **Batch Processing**:
  - Parquet files are processed in batches of 1000 rows (maxRowsPerBatch).
  - File concurrency: Maximum 4 files processed simultaneously (maxFileWorkers).

##  Flow :
**Step 1**: Parquet files are stored in a folder (bulk data).

**Step 2**: Files are read concurrently.

**Step 3**: Each file's rows are processed in batches (batch size = 1000 rows).

**Step 4**: Documents are created from rows and indexed in-memory (for fast search).

**Step 5**: Frontend React app sends search queries -> Backend searches in searchIndex -> Returns matching documents + search time.

## 🔍 Search Functionality:
**Search Engine Type**: In-Memory Inverted Index.

**Query Logic**: Basic AND search (documents must match all query terms).

**Tokenization**: Basic word split (although tokenize function itself isn’t shown, it’s obviously a simple split on spaces/lowercasing etc).


## ⚡ Performance Optimizations:
- **Concurrency**:

  - Multiple files processed together (with limit: 4 at a time).

  - Multiple row batches inside each file processed (up to 8 goroutines at once).

- **Mutex**:

  - indexMutex ensures thread-safe writes into the index.

- **Batch Inserts**:

  - Rows are processed into documents per batch to reduce locking overhead.


## 📂 Folder & File Assumptions:

- Folder path is passed at runtime.

- Only .parquet files inside the folder are processed.

- Non-parquet files or subfolders are ignored.



## 📈 Limits / Scaling Observations:

**In-memory search engine** => Limited by RAM (not good if dataset becomes huge).

**No persistence of index**=> If backend restarts, entire parquet loading + indexing has to happen again.

**Simple token matching**=> No stemming, synonyms, typo tolerance (very basic full text search).

## Running the app

To run the backend go inside the folder and run `backend/apica-search-engine` and run `go run .\search-engine\main.go`

To run the frontend go inside the folder and run `frontend/apica-search-engine` and run `npm start`