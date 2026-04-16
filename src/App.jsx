import React, { useState } from 'react';
import { 
  ThemeProvider, createTheme, CssBaseline, Container, Typography, 
  Box, Button, Card, CardContent, Grid, Chip, Divider, IconButton 
} from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' }, // Google Blue
    background: { default: '#f5f5f5' },
  },
});

// 這裡放入你文件中定義的各人數系統資料矩陣 (Data Matrix)
const SCHEDULES = {
  5: [
    { table: [['A', 'B'], ['C', 'D']], rest: ['E'] },
    { table: [['E', 'A'], ['B', 'C']], rest: ['D'] },
    // ... 依此類推
  ],
  6: [ /* 你的 6 人表 */ ],
  // ... 其他人數
};

const TableTennisApp = () => {
  const [players, setPlayers] = useState(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  const [currentRound, setCurrentRound] = useState(0);
  const [view, setView] = useState('setup'); // 'setup', 'match'

  // 3人模式特有的手動換人狀態
  const [threePlayerMatch, setThreePlayerMatch] = useState({ on: ['A', 'B'], rest: 'C' });

  const handleSwap3 = (idx) => {
    const newOn = [...threePlayerMatch.on];
    const oldPlayer = newOn[idx];
    newOn[idx] = threePlayerMatch.rest;
    setThreePlayerMatch({ on: newOn, rest: oldPlayer });
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom align="center" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
          🏓 智能分組器
        </Typography>

        {/* 7人模式展示：符合你的高換血率設計 */}
        <Card sx={{ borderRadius: 4, boxShadow: 3 }}>
          <CardContent>
            <Typography variant="h6" color="textSecondary" gutterBottom>
              第 {currentRound + 1} 場次 (7人系統)
            </Typography>
            
            <Box sx={{ bgcolor: '#e3f2fd', p: 3, borderRadius: 2, textAlign: 'center', mb: 2 }}>
              <Typography variant="subtitle2">重點桌 (雙打)</Typography>
              <Grid container spacing={2} alignItems="center" justifyContent="center" sx={{ mt: 1 }}>
                <Grid item><Chip label="A" color="primary" /></Grid>
                <Grid item><Chip label="B" color="primary" /></Grid>
                <Grid item><Typography variant="h6">VS</Typography></Grid>
                <Grid item><Chip label="C" color="primary" /></Grid>
                <Grid item><Chip label="D" color="primary" /></Grid>
              </Grid>
            </Box>

            <Divider sx={{ my: 2 }}>休息 / 單打區</Divider>

            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
              <Chip label="E" variant="outlined" />
              <Chip label="F" variant="outlined" />
              <Chip label="G" variant="outlined" />
            </Box>
          </CardContent>
        </Card>

        {/* 3人模式手動換人 UI */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>3人模式 (手動換位)</Typography>
          <Grid container spacing={2} justifyContent="center" alignItems="center">
            <Grid item xs={5}>
              <Button fullWidth variant="contained" onClick={() => handleSwap3(0)}>
                {threePlayerMatch.on[0]} (休息)
              </Button>
            </Grid>
            <Grid item xs={2} sx={{ textAlign: 'center' }}>VS</Grid>
            <Grid item xs={5}>
              <Button fullWidth variant="contained" onClick={() => handleSwap3(1)}>
                {threePlayerMatch.on[1]} (休息)
              </Button>
            </Grid>
            <Grid item xs={12} sx={{ textAlign: 'center', mt: 1 }}>
              <Typography variant="body2">候場中: {threePlayerMatch.rest}</Typography>
            </Grid>
          </Grid>
        </Box>

        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
          <Button variant="outlined" onClick={() => setCurrentRound(Math.max(0, currentRound - 1))}>上一步</Button>
          <Button variant="contained" onClick={() => setCurrentRound(currentRound + 1)}>下一場次</Button>
        </Box>
      </Container>
    </ThemeProvider>
  );
};

export default TableTennisApp;