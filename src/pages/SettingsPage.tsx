import React from 'react';
import { Container, Paper, Typography } from '@mui/material';
import RateEditor from '../components/RateEditor';

const SettingsPage: React.FC = () => {
  return (
    <Container maxWidth="md" className="py-6">
      <Typography variant="h4" component="h1" className="font-bold mb-6">
        Settings
      </Typography>
      <Paper className="p-6">
        <RateEditor />
      </Paper>
    </Container>
  );
};

export default SettingsPage;