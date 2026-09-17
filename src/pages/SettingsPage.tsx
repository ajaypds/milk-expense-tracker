import React from 'react';
import { Container, Typography, Box } from '@mui/material';
import RateEditor from '../components/RateEditor';
import BillingCycleEditor from '../components/BillingCycleEditor';
import VendorSettingsEditor from '../components/VendorSettingsEditor';

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

      <Box className="flex flex-col gap-6">
        <RateEditor />
        <BillingCycleEditor />
        <VendorSettingsEditor />
      </Box>

      {version && (
        <Typography variant="caption" className="block text-center text-gray-400 mt-8">
          App Version: {version}
        </Typography>
      )}
    </Container>
  );
};

export default SettingsPage;