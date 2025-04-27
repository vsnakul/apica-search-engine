import React, { useState } from 'react';
import { 
  Paper, 
  InputBase, 
  Button, 
  Box 
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

const SearchBar = ({ onSearch }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <Paper
      component="form"
      onSubmit={handleSubmit}
      sx={{ 
        p: '2px 4px', 
        display: 'flex', 
        alignItems: 'center', 
        width: '100%',
        mb: 4,
        border: '1px solid #e0e0e0',
        boxShadow: 1
      }}
    >
      <InputBase
        sx={{ ml: 1, flex: 1 }}
        placeholder="Enter your search query..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        inputProps={{ 'aria-label': 'search' }}
      />
      <Button 
        type="submit" 
        variant="contained" 
        sx={{ p: '10px 20px', borderRadius: '0 4px 4px 0' }}
        endIcon={<SearchIcon />}
      >
        Search
      </Button>
    </Paper>
  );
};

export default SearchBar;