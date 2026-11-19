import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store/store";
import { updateVendorSettings } from "../store/settingsSlice";
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Box,
} from "@mui/material";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import PaymentsIcon from "@mui/icons-material/Payments";

const VendorSettingsEditor: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const settings = useSelector((state: RootState) => state.settings.settings);

  const [vendorName, setVendorName] = useState(settings.vendorName || "");
  const [vendorUpiId, setVendorUpiId] = useState(settings.vendorUpiId || "");
  const [vendorPhone, setVendorPhone] = useState(settings.vendorPhone || "");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    setVendorName(settings.vendorName || "");
    setVendorUpiId(settings.vendorUpiId || "");
    setVendorPhone(settings.vendorPhone || "");
  }, [settings.vendorName, settings.vendorUpiId, settings.vendorPhone]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await dispatch(
        updateVendorSettings({
          vendorName: vendorName.trim(),
          vendorUpiId: vendorUpiId.trim(),
          vendorPhone: vendorPhone.trim(),
        })
      ).unwrap();
      setSavedMsg("Vendor & payment details saved successfully!");
      setTimeout(() => setSavedMsg(""), 4000);
    } catch (err) {
      console.error("Failed to save vendor details", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card elevation={1}>
      <CardContent>
        <Typography variant="h6" component="h2" className="font-semibold mb-1 flex items-center gap-2">
          <PaymentsIcon color="primary" /> Vendor & Payment Details
        </Typography>
        <Typography variant="body2" color="textSecondary" className="mb-4">
          Save your milk vendor's information to enable 1-tap WhatsApp bill sharing and direct UPI payments.
        </Typography>

        {savedMsg && (
          <Alert severity="success" className="mb-4">
            {savedMsg}
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              id="vendorName"
              label="Vendor / Dairy Name"
              placeholder="e.g. Ramesh Dairy"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              id="vendorPhone"
              label="WhatsApp Phone Number"
              placeholder="e.g. +919876543210"
              value={vendorPhone}
              onChange={(e) => setVendorPhone(e.target.value)}
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <WhatsAppIcon color="success" fontSize="small" sx={{ mr: 1 }} />
                ),
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              id="vendorUpiId"
              label="Vendor UPI ID"
              placeholder="e.g. vendor@upi or phone@paytm"
              value={vendorUpiId}
              onChange={(e) => setVendorUpiId(e.target.value)}
              size="small"
              fullWidth
            />
          </Grid>
        </Grid>

        <Box className="mt-4 flex justify-end">
          <Button
            variant="contained"
            color="primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <CircularProgress size={24} /> : "Save Vendor Details"}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default VendorSettingsEditor;
