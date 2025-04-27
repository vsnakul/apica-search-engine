package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/sirupsen/logrus"
)

func DefaultConfig() *Config {
	return &Config{
		ListenAddress: ":8080",
		ParquetPath:  "C:\\Projects\\the-mail\\apica-search-engine\\docs",
	}
}

// Config configures an oracle.
type Config struct {
	// ListenAddress is an address the oracle HTTP listens on.
	ListenAddress string `yaml:"listen-address"`
	ParquetPath string `yaml:"parquet-path"`
}

// Valid validates an oracle configuration.
func (c *Config) Valid() error {
	if c == nil {
		return fmt.Errorf("missing config")
	}
	if c.ListenAddress == "" {
		return fmt.Errorf("missing listen address")
	}
	if c.ParquetPath == "" {
		return fmt.Errorf("missing parquet path")
	}
	return nil
}

// Application represents the API application
type Application struct {
	config *Config
	logger *logrus.Logger
	searchIndex *SearchIndex
}

// New creates a new Application instance
func New(config *Config) (*Application, error) {
	logger := logrus.New()
	
	// Configure the logger
	logger.SetFormatter(&logrus.TextFormatter{
		FullTimestamp: true,
	})

	searchIndex = NewSearchIndex()
	
	app := &Application{
		config: config,
		logger: logger,
		searchIndex: searchIndex,
	}
	
	// Initialize database connection
	
	return app, nil
}

// initDB initializes the database connection

// Close cleans up resources
func (app *Application) Close() {
	// Close database connections and other resources
	app.logger.Info("Shutting down application")
}

// setupRouter configures the HTTP router with API endpoints
func (app *Application) setupRouter() http.Handler {
	// Create a new HTTP router
	mux := http.NewServeMux()
	
	// Register API endpoints
	mux.HandleFunc("/api/search", app.handleSearch)	
	mux.HandleFunc("/api/health",app.healthCheck)
	// You can add middleware here if needed
	var handler http.Handler = mux
	
	// Add request logging middleware
	handler = app.loggingMiddleware(handler)
	
	return handler
}



// Run starts the API server
func Run(config *Config) error {
	// ctx := context.Background()
	
	// Create and initialize the application
	app, err := New(config)
	if err != nil {
		return err
	}
	defer app.Close()
	
	// Log startup information
	app.logger.WithFields(logrus.Fields{
		"listen_address": config.ListenAddress,
	}).Info("Starting API server")
	
	// Configure and set up the HTTP router
	handler := app.setupRouter()
	
	// Create HTTP server
	server := &http.Server{
		Addr:         config.ListenAddress,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	
	// Process Parquet file
	err = processParquetFiles(app.config.ParquetPath,app.logger)
	if err != nil {
		app.logger.Fatalf("Error processing Parquet file: %v", err)
	}
	
	// Start the server
	app.logger.Infof("Server listening on %s", config.ListenAddress)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("server error: %w", err)
	}

	return nil
}

// healthCheckHandler handles health check requests
func (app *Application) healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"UP"}`))
}

// itemsHandler handles item-related API requests
func (app *Application) handleSearch(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	
	// Handle preflight requests
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	
	// Only allow GET requests
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	// Get query parameter
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Missing query parameter 'q'", http.StatusBadRequest)
		return
	}
	
	// Get pagination parameters
	pageStr := r.URL.Query().Get("page")
	pageSizeStr := r.URL.Query().Get("pageSize")
	
	page := 1
	pageSize := 10
	
	if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
		page = p
	}
	
	if ps, err := strconv.Atoi(pageSizeStr); err == nil && ps > 0 && ps <= 100 {
		pageSize = ps
	}
	
	// Perform search
	results, duration := searchIndex.Search(query)
	
	// Paginate results
	startIdx := (page - 1) * pageSize
	endIdx := startIdx + pageSize
	
	if startIdx >= len(results) {
		startIdx = 0
		endIdx = 0
	}
	
	if endIdx > len(results) {
		endIdx = len(results)
	}
	
	paginatedResults := results
	if startIdx < endIdx {
		paginatedResults = results[startIdx:endIdx]
	} else {
		paginatedResults = []*Document{}
	}
	
	// Prepare response
	response := SearchResult{
		Query:         query,
		TotalResults:  len(results),
		SearchTimeMs:  float64(duration.Microseconds()) / 1000.0,
		Results:       paginatedResults,
	}
	
	// Send JSON response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// loggingMiddleware logs HTTP requests
func (app *Application) loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		
		// Call the next handler
		next.ServeHTTP(w, r)
		
		// Log the request
		app.logger.WithFields(logrus.Fields{
			"method":   r.Method,
			"path":     r.URL.Path,
			"duration": time.Since(start),
			"remote":   r.RemoteAddr,
		}).Info("HTTP request")
	})
}