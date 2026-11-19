import React, { useState } from "react";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  IconButton,
  Tooltip,
} from "@mui/material";
import PaymentsIcon from "@mui/icons-material/Payments";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import QrCodeIcon from "@mui/icons-material/QrCode";

interface Props {
  vendorUpiId: string;
  vendorName?: string;
  amount: number;
  monthPeriod: string;
  onPaidSuccess?: () => void;
}

const UpiPayButton: React.FC<Props> = ({
  vendorUpiId,
  vendorName = "Milk Vendor",
  amount,
  monthPeriod,
  onPaidSuccess,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Generate UPI payment intent URI
  const upiUri = `upi://pay?pa=${vendorUpiId}&pn=${encodeURIComponent(
    vendorName
  )}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Milk Bill ${monthPeriod}`)}`;

  const handleClickPay = () => {
    // Detect mobile device
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      // Direct intent launch
      window.location.href = upiUri;
    } else {
      // Open desktop modal with QR and UPI ID
      setDialogOpen(true);
    }
  };

  const handleCopyUpi = async () => {
    try {
      await navigator.clipboard.writeText(vendorUpiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      console.warn("Could not copy UPI ID");
    }
  };

  // Safe QR code image generator using standard public QR API
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    upiUri
  )}`;

  return (
    <>
      <Button
        variant="contained"
        color="secondary"
        size="small"
        startIcon={<PaymentsIcon />}
        onClick={handleClickPay}
        sx={{
          textTransform: "none",
          fontWeight: 700,
          background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
          boxShadow: "0 4px 12px rgba(99, 102, 241, 0.25)",
        }}
      >
        Pay ₹{amount.toLocaleString()} via UPI
      </Button>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle className="text-center font-bold flex items-center justify-center gap-2">
          <QrCodeIcon color="primary" /> Scan to Pay via UPI
        </DialogTitle>
        <DialogContent dividers className="flex flex-col items-center text-center">
          <Typography variant="body2" color="textSecondary" className="mb-4">
            Scan this QR code with Google Pay, PhonePe, or Paytm on your phone:
          </Typography>

          <Box className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200 mb-4 inline-block">
            <img
              src={qrCodeUrl}
              alt="UPI Payment QR Code"
              width={180}
              height={180}
              className="rounded-lg"
            />
          </Box>

          <Typography variant="h5" className="font-extrabold text-blue-600 dark:text-blue-400 mb-1">
            ₹{amount.toLocaleString()}
          </Typography>
          <Typography variant="caption" color="textSecondary" className="mb-3">
            Payment for {vendorName} ({monthPeriod})
          </Typography>

          <Box className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl flex justify-between items-center border border-slate-200 dark:border-slate-700">
            <div className="text-left overflow-hidden">
              <Typography variant="caption" color="textSecondary" className="block">
                UPI ID:
              </Typography>
              <Typography variant="body2" className="font-mono font-bold truncate">
                {vendorUpiId}
              </Typography>
            </div>
            <Tooltip title={copied ? "Copied!" : "Copy UPI ID"}>
              <IconButton onClick={handleCopyUpi} size="small">
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogContent>
        <DialogActions className="px-6 py-3 flex justify-between">
          <Button onClick={() => setDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          {onPaidSuccess && (
            <Button
              variant="contained"
              color="success"
              onClick={() => {
                setDialogOpen(false);
                onPaidSuccess();
              }}
            >
              Mark as Paid
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default UpiPayButton;
