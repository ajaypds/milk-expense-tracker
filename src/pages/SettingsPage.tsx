import React from 'react';
import { Container, Paper, Typography } from '@mui/material';
import RateEditor from '../components/RateEditor';

const SettingsPage: React.FC = () => {
  const [version, setVersion] = React.useState<string>("");

  React.useEffect(() => {
    const fetchVersion = async () => {
      try {
        const info = await import("@capacitor/app").then((m) => m.App.getInfo());
        setVersion(`v${info.version} (${info.build})`);
      } catch (e) {
        console.warn("Could not fetch app version", e);
      }
    };
    fetchVersion();
  }, []);

  return (
    <Container maxWidth="md" className="py-6">
      <Typography variant="h4" component="h1" className="font-bold mb-6">
        Settings
      </Typography>
      <Paper className="p-6 mb-6">
        <RateEditor />
      </Paper>

      {version && (
        <Typography variant="caption" className="block text-center text-gray-400 mt-8">
          App Version: {version}
        </Typography>
      )}
    </Container>
  );
};

export default SettingsPage;