// SearchApp.js
import React, { useState, useCallback } from 'react';
import { Container, Typography, Box, Button, CircularProgress, Alert, Snackbar } from '@mui/material';

import SearchBar from './SearchBar';
import ResultsList from './ResultsList';
import { searchMessages, handleApiRequest } from '../../services/api';

const SearchApp = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  const resultsPerPage = 10;

  const handleSearch = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) return;
    
    setQuery(searchQuery);
    setLoading(true);
    setError(null);
    setPage(1);
    
    const [data, error] = await handleApiRequest(
      searchMessages(searchQuery, 1, resultsPerPage)
    );
    
    setLoading(false);
    
    if (error) {
      setError('Failed to search messages. Please try again later.');
      return;
    }
    
    setResults(data.results || []);
    setTotalResults(data.totalResults || 0);
    setHasMore(resultsPerPage < (data.totalResults || 0));
  }, [resultsPerPage]);

  const handleLoadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    
    const nextPage = page + 1;
    setLoading(true);
    
    const [data, error] = await handleApiRequest(
      searchMessages(query, nextPage, resultsPerPage)
    );
    
    setLoading(false);
    
    if (error) {
      setError('Failed to load more results. Please try again.');
      return;
    }
    
    // Append new results to existing ones
    setResults(prevResults => [...prevResults, ...(data.results || [])]);
    setPage(nextPage);
    setHasMore((nextPage * resultsPerPage) < (data.totalResults || 0));
  }, [query, page, hasMore, loading, resultsPerPage]);

  const handleCloseError = () => {
    setError(null);
  };

  return (
    <Container maxWidth="md">
      <Box my={4} textAlign="center">
        <Typography variant="h4" component="h1" gutterBottom>
          Apica Search Engine
        </Typography>
        
        <SearchBar onSearch={handleSearch} />
        
        {query && !loading && !error && (
          <Box mt={2} mb={2} textAlign="left">
            <Typography variant="h6">
              Search Results for "{query}"
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Showing {results.length} of {totalResults} results
            </Typography>
          </Box>
        )}
        
        <ResultsList results={results} />
        
        {hasMore && (
          <Box mt={3} textAlign="center">
            <Button 
              variant="contained" 
              color="primary" 
              onClick={handleLoadMore}
              disabled={loading}
            >
              {loading ? (
                <>
                  <CircularProgress size={24} color="inherit" style={{ marginRight: 10 }} />
                  Loading...
                </>
              ) : (
                'Load More'
              )}
            </Button>
          </Box>
        )}
        
        <Snackbar open={!!error} autoHideDuration={6000} onClose={handleCloseError}>
          <Alert onClose={handleCloseError} severity="error">
            {error}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
};

export default SearchApp;