import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../store/store';
import { fetchSettings, updateSettings } from '../store/settingsSlice';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Box,
  Grid,
} from '@mui/material';

const RateEditor: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { settings, loading } = useSelector((state: RootState) => state.settings);
  const [rate, setRate] = useState(settings.milkRate);

  useEffect(() => {
    dispatch(fetchSettings());
  }, [dispatch]);

  useEffect(() => {
    setRate(settings.milkRate);
  }, [settings.milkRate]);

  const handleSave = () => {
    if (rate > 0) {
      dispatch(updateSettings({ milkRate: rate }));
      alert('Rate updated successfully!');
    } else {
      alert('Please enter a valid rate.');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" className="py-8">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" component="h2" className="font-semibold mb-4">
          Manage Milk Rate
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid>
            <TextField
              id="milkRate"
              label="Rate (₹ per liter)"
              type="number"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              variant="outlined"
              size="small"
            />
          </Grid>
          <Grid>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Save'}
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default RateEditor;