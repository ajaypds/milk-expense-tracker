import React, { useState } from "react";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Snackbar,
} from "@mui/material";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import dayjs from "dayjs";
import { getPeriodDates } from "../utils/dateUtils";
import type { MilkEntry } from "../types";

interface Props {
  monthPeriod: string;
  totalQuantity: number;
  rate: number;
  totalAmount: number;
  paymentStatus: "Paid" | "Unpaid";
  entries?: MilkEntry[];
  vendorPhone?: string;
  vendorName?: string;
}

const WhatsAppShareButton: React.FC<Props> = ({
  monthPeriod,
  totalQuantity,
  rate,
  totalAmount,
  paymentStatus,
  entries = [],
  vendorPhone = "",
  vendorName = "",
}) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Generate formatted bill message
  const generateMessage = () => {
    const dates = getPeriodDates(monthPeriod);
    const readableMonth = dayjs(`${monthPeriod}-01`).format("MMMM YYYY");
    const formattedStartDate = dayjs(dates.startDate).format("DD MMM YYYY");
    const formattedEndDate = dayjs(dates.endDate).format("DD MMM YYYY");

    // Find skipped days
    const skippedEntries = entries.filter((e) => !e.milkTaken || e.quantity === 0);

    let text = `🥛 *Milk Bill Summary — ${readableMonth}*\n`;
    if (vendorName) text += `To: ${vendorName}\n`;
    text += `📅 Cycle: ${formattedStartDate} → ${formattedEndDate}\n`;
    text += `------------------------------------\n`;
    text += `• Total Liters: *${totalQuantity} L*\n`;
    text += `• Rate: *₹${rate}/L*\n`;
    text += `• Total Amount: *₹${totalAmount.toLocaleString()}*\n`;
    text += `• Status: *${paymentStatus === "Paid" ? "✅ Paid" : "⏳ Due / Unpaid"}*\n`;

    if (skippedEntries.length > 0) {
      text += `\n🚫 *Skipped Days (${skippedEntries.length})*:\n`;
      skippedEntries.forEach((e) => {
        text += `• ${dayjs(e.date).format("DD MMM (ddd)")}: 0 L\n`;
      });
    } else {
      text += `\n✨ No days skipped this cycle.\n`;
    }

    text += `------------------------------------\n`;
    text += `_Generated via Milk Expense Tracker_`;

    return text;
  };

  const messageText = generateMessage();

  const handleShareWhatsApp = () => {
    const encoded = encodeURIComponent(messageText);
    const cleanPhone = vendorPhone ? vendorPhone.replace(/[^0-9]/g, "") : "";
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;

    window.open(url, "_blank");
    setPreviewOpen(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      console.warn("Could not copy text to clipboard");
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        color="success"
        size="small"
        startIcon={<WhatsAppIcon />}
        onClick={() => setPreviewOpen(true)}
        sx={{ textTransform: "none", fontWeight: 600 }}
      >
        Share Bill
      </Button>

      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle className="flex items-center gap-2 font-bold">
          <WhatsAppIcon color="success" /> WhatsApp Bill Preview
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="textSecondary" className="mb-3">
            Review the itemized message that will be sent:
          </Typography>
          <Box className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl font-mono text-sm whitespace-pre-line border border-slate-200 dark:border-slate-700">
            {messageText}
          </Box>
        </DialogContent>
        <DialogActions className="px-6 py-3 flex justify-between">
          <Button
            startIcon={<ContentCopyIcon />}
            onClick={handleCopy}
            color="inherit"
            size="small"
          >
            Copy Text
          </Button>
          <Box className="flex gap-2">
            <Button onClick={() => setPreviewOpen(false)} color="inherit">
              Cancel
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={<WhatsAppIcon />}
              onClick={handleShareWhatsApp}
            >
              Send on WhatsApp
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={copied}
        autoHideDuration={3000}
        onClose={() => setCopied(false)}
        message="Bill summary copied to clipboard!"
      />
    </>
  );
};

export default WhatsAppShareButton;
