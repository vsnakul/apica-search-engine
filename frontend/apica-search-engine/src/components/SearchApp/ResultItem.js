import React, { useState } from 'react';
import { 
  Box, 
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper,
  Typography,
  Collapse,
  IconButton,
  Chip,
  Grid,
  Divider,
  Tabs,
  Tab,
  Tooltip,
  Snackbar,
  Alert
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

// Extract timestamp helper function - can be used for sorting
export const extractTimestamp = (result) => {
  try {
    // First try to extract from the Message field which contains the ISO timestamp
    if (result.Message && typeof result.Message === 'string') {
      const isoMatch = result.Message.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d+\+\d{2}:\d{2}/);
      if (isoMatch) {
        return new Date(isoMatch[0]).getTime();
      }
    }
    
    // Try to use the MessageRaw field
    if (result.MessageRaw) {
      try {
        const parsedData = JSON.parse(result.MessageRaw);
        if (parsedData.date) {
          // Handle Unix timestamp (in seconds)
          return parsedData.date * 1000;
        }
      } catch (e) {
        // MessageRaw wasn't valid JSON
        console.error('Failed to parse MessageRaw:', e);
      }
    }
    
    // Return current time as fallback
    return new Date().getTime();
  } catch (e) {
    return new Date().getTime();
  }
};

// Get kubernetes metadata from result
const extractKubernetesInfo = (result) => {
  try {
    if (result.MessageRaw) {
      const parsedData = JSON.parse(result.MessageRaw);
      return parsedData.kubernetes || {};
    }
    return {};
  } catch (e) {
    return {};
  }
};

// Parse the log content to get the actual log message without timestamps
const parseLogContent = (result) => {
  try {
    if (result.MessageRaw) {
      const parsedData = JSON.parse(result.MessageRaw);
      const logMatch = parsedData.log.match(/\] ([A-Z]+) (.+)/);
      if (logMatch && logMatch.length >= 3) {
        return {
          level: logMatch[1],
          message: logMatch[2]
        };
      }
      return { message: parsedData.log };
    }
    return { message: result.Message };
  } catch (e) {
    return { message: result.Message };
  }
};

const ResultItem = ({ result, isOdd }) => {
  const [expanded, setExpanded] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [copySnackbar, setCopySnackbar] = useState(false);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleCopy = (text, event) => {
    event.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopySnackbar(true);
    });
  };

  const handleCloseSnackbar = () => {
    setCopySnackbar(false);
  };

  const k8sInfo = extractKubernetesInfo(result);
  
  const logContent = parseLogContent(result);
  
  const displayTimestamp = () => {
    try {
      const isoMatch = result.Message.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d+\+\d{2}:\d{2}/);
      if (isoMatch) {
        const date = new Date(isoMatch[0]);
        return date.toISOString().replace('T', ' ').substr(0, 19);
      }
      return 'Unknown date';
    } catch (e) {
      return 'Unknown date';
    }
  };

  // Get log level (INFO, DEBUG, etc.)
  const getLogLevel = () => {
    try {
      const levelMatch = result.Message.match(/\] ([A-Z]+) /);
      return levelMatch && levelMatch[1] ? levelMatch[1] : '';
    } catch (e) {
      return '';
    }
  };

  // Get color for log level
  const getLevelColor = (level) => {
    switch (level) {
      case 'ERROR': return '#f44336';
      case 'WARN': return '#ff9800';
      case 'INFO': return '#2196f3';
      case 'DEBUG': return '#4caf50';
      case 'TRACE': return '#9e9e9e';
      default: return '#757575';
    }
  };

  const logLevel = getLogLevel();

  return (
    <>
      <TableContainer component={Paper} sx={{ 
        mb: 1, 
        border: '1px solid #e0e0e0', 
        boxShadow: 'none',
        bgcolor: isOdd ? '#f9f9f9' : '#ffffff'
      }}>
        <Table size="small">
          <TableBody>
            <TableRow 
              hover 
              onClick={() => setExpanded(!expanded)}
              sx={{ 
                cursor: 'pointer',
                '&:hover': { bgcolor: isOdd ? '#f0f0f0' : '#f5f5f5' },
                borderBottom: expanded ? '1px solid #e0e0e0' : 'none'
              }}
            >
              <TableCell padding="checkbox" sx={{ width: '30px' }}>
                <IconButton size="small">
                  {expanded ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
                </IconButton>
              </TableCell>
              <TableCell sx={{ width: '180px', color: '#666', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                {displayTimestamp()}
              </TableCell>
              <TableCell sx={{ width: '80px', padding: '0 8px' }}>
                {logLevel && (
                  <Chip 
                    label={logLevel} 
                    size="small" 
                    sx={{ 
                      bgcolor: getLevelColor(logLevel) + '20',
                      color: getLevelColor(logLevel),
                      fontWeight: 'bold',
                      fontSize: '0.7rem'
                    }} 
                  />
                )}
              </TableCell>
              <TableCell sx={{ 
                fontFamily: 'monospace', 
                fontSize: '0.875rem',
                whiteSpace: 'nowrap', 
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '600px',
                position: 'relative'
              }}>
                {k8sInfo.pod_name ? (
                  <Typography component="span" sx={{ color: '#666', mr: 1, fontSize: '0.875rem' }}>
                    {k8sInfo.pod_name}:
                  </Typography>
                ) : null}
                <Typography component="span" sx={{ color: '#333', fontSize: '0.875rem' }}>
                  {logContent.message}
                </Typography>
                <Tooltip title="Copy log message">
                  <IconButton 
                    size="small" 
                    sx={{ 
                      position: 'absolute', 
                      right: 8,
                      opacity: 0.6,
                      '&:hover': { opacity: 1 }
                    }}
                    onClick={(e) => handleCopy(result.Message, e)}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
            
            {expanded && (
              <TableRow>
                <TableCell colSpan={4} sx={{ bgcolor: isOdd ? '#f2f2f2' : '#f8f8f8', padding: 0 }}>
                  <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs value={tabValue} onChange={handleTabChange} aria-label="log detail tabs">
                      <Tab label="Details" />
                      <Tab label="Kubernetes" />
                      <Tab label="Raw" />
                    </Tabs>
                  </Box>
                  
                  <TabPanel value={tabValue} index={0}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Typography variant="subtitle2">Log Message</Typography>
                        <Tooltip title="Copy log message">
                          <IconButton 
                            size="small" 
                            sx={{ ml: 1 }}
                            onClick={(e) => handleCopy(logContent.message, e)}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                          {logContent.message}
                        </Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2">ID</Typography>
                        <Typography variant="body2">{result.ID}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2">Sender</Typography>
                        <Typography variant="body2">{result.Sender}</Typography>
                      </Grid>
                    </Grid>
                  </TabPanel>
                  
                  <TabPanel value={tabValue} index={1}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Typography variant="subtitle2">Kubernetes Information</Typography>
                        <Tooltip title="Copy Kubernetes data">
                          <IconButton 
                            size="small" 
                            sx={{ ml: 1 }}
                            onClick={(e) => handleCopy(JSON.stringify(k8sInfo, null, 2), e)}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2">Pod Name</Typography>
                        <Typography variant="body2">{k8sInfo.pod_name || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2">Namespace</Typography>
                        <Typography variant="body2">{k8sInfo.namespace_name || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2">Host</Typography>
                        <Typography variant="body2">{k8sInfo.host || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2">Container</Typography>
                        <Typography variant="body2">{k8sInfo.container_name || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2">Labels</Typography>
                        <Box sx={{ mt: 1 }}>
                          {k8sInfo.labels && Object.entries(k8sInfo.labels).map(([key, value]) => (
                            <Chip 
                              key={key}
                              label={`${key}: ${value}`}
                              size="small"
                              sx={{ mr: 0.5, mb: 0.5, fontSize: '0.75rem' }}
                            />
                          ))}
                        </Box>
                      </Grid>
                    </Grid>
                  </TabPanel>
                  
                  <TabPanel value={tabValue} index={2}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="subtitle2">Raw Data</Typography>
                      <Tooltip title="Copy raw data">
                        <IconButton 
                          size="small"
                          onClick={(e) => handleCopy(result.MessageRaw, e)}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Box sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: '0.75rem', overflowX: 'auto' }}>
                      {JSON.stringify(JSON.parse(result.MessageRaw), null, 2)}
                    </Box>
                  </TabPanel>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      <Snackbar
        open={copySnackbar}
        autoHideDuration={2000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity="success" sx={{ width: '100%' }}>
          Copied to clipboard
        </Alert>
      </Snackbar>
    </>
  );
};

// TabPanel component for the expanded view
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`log-tabpanel-${index}`}
      aria-labelledby={`log-tab-${index}`}
      {...other}
      style={{ padding: '16px' }}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

export default ResultItem;