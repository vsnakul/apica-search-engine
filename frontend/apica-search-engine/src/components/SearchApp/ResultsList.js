import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  CircularProgress,
  Toolbar,
  IconButton,
  Tooltip
} from '@mui/material';
import SortIcon from '@mui/icons-material/Sort';
import ResultItem, { extractTimestamp } from './ResultItem';

const ResultsList = ({ results, loading }) => {
  const [sortDirection, setSortDirection] = useState('desc'); // 'desc' = newest first, 'asc' = oldest first
  const [sortedResults, setSortedResults] = useState([]);
  
  // Sort results whenever results array or sort direction changes
  useEffect(() => {
    if (!results || results.length === 0) {
      setSortedResults([]);
      return;
    }
    
    const sorted = [...results].sort((a, b) => {
      const timestampA = extractTimestamp(a);
      const timestampB = extractTimestamp(b);
      
      return sortDirection === 'asc' 
        ? timestampA - timestampB 
        : timestampB - timestampA;
    });
    
    setSortedResults(sorted);
  }, [results, sortDirection]);

  // Toggle sort direction
  const handleToggleSort = () => {
    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!results || results.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body1" color="text.secondary">
          No results found.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Toolbar 
        disableGutters 
        sx={{ 
          mb: 2, 
          display: 'flex', 
          justifyContent: 'space-between',
          borderBottom: '1px solid #e0e0e0',
          minHeight: '48px',
          px: 1
        }}
      >
        <Typography variant="subtitle1">
          {sortedResults.length} {sortedResults.length === 1 ? 'Log Entry' : 'Log Entries'}
        </Typography>
        
        <Tooltip title={sortDirection === 'desc' ? 'Currently: Newest First' : 'Currently: Oldest First'}>
          <IconButton 
            onClick={handleToggleSort} 
            size="small"
            color={sortDirection === 'desc' ? 'primary' : 'default'}
          >
            <SortIcon fontSize="small" />
            <Typography variant="caption" sx={{ ml: 0.5 }}>
              {sortDirection === 'desc' ? 'Newest First' : 'Oldest First'}
            </Typography>
          </IconButton>
        </Tooltip>
      </Toolbar>
      
      <Box sx={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
        {sortedResults.map((result, index) => (
          <ResultItem 
            key={result.ID || result.id || `result-${index}`} 
            result={result} 
            isOdd={index % 2 !== 0}
          />
        ))}
      </Box>
    </Box>
  );
};

export default ResultsList;