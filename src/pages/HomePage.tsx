import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { Container } from "@mui/material";
import DailyEntryForm from "../components/DailyEntryForm";
import DailyEntriesTable from "../components/DailyEntriesTable";
import type { MilkEntry } from "../types";
import { fetchEntriesForPeriod, fetchAllEntries } from "../store/milkSlice";
import { getMonthPeriod } from "../utils/dateUtils";
import type { AppDispatch } from "../store/store";

import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { Paper, Typography } from "@mui/material";

const HomePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [editingEntry, setEditingEntry] = useState<MilkEntry | null>(null);

  const entries = useSelector((state: RootState) => state.milk.entries);
  const milkRate = useSelector((state: RootState) => state.settings.settings.milkRate);

  const totalQuantity = entries.reduce((sum, entry) => sum + (entry.milkTaken ? entry.quantity : 0), 0);
  const totalAmount = totalQuantity * milkRate;

  return (
    <Container className="pt-4 pb-12">
      {/* <Typography variant="h4" component="h1" className="font-bold mb-6">
        Daily Milk Entry
      </Typography> */}
      {/* <Grid container spacing={3}> */}
      {/* <Grid> */}
      {/* <Paper className="p-2"> */}
      <DailyEntryForm
        initialEntry={editingEntry}
        onSave={async (entry) => {
          setEditingEntry(null);
          // Refresh all entries so the billing period dropdown updates with any new period
          await dispatch(fetchAllEntries());
          // Also fetch the period of the saved entry so the table can show server-side filtered results if needed
          try {
            const period = getMonthPeriod(new Date(entry.date));
            await dispatch(fetchEntriesForPeriod(period));
          } catch {
            // ignore
          }
        }}
      />
      {/* </Paper> */}
      {/* </Grid> */}
      {/* <Paper className="p-2"> */}
      {/* </Paper> */}
      {/* </Grid> */}
      {/* <Paper className="p-2"> */}
      <div className="mt-4">
        <Paper className="px-4 py-2 mb-4 flex justify-between items-center bg-blue-50 dark:bg-slate-800" elevation={1}>
           <Typography variant="subtitle2" className="font-semibold text-gray-600 dark:text-gray-300">
             Current Period Total
           </Typography>
           <div className="flex items-center gap-4">
             <Typography variant="body1" className="font-bold" color="primary">
               {totalQuantity} L
             </Typography>
             <Typography variant="body1" className="font-bold" color="primary">
               ₹{totalAmount}
             </Typography>
           </div>
        </Paper>
      </div>
      <DailyEntriesTable onEdit={(entry) => setEditingEntry(entry)} />
      {/* </Paper> */}
      {/* <Grid>
      </Grid> */}
      {/* </Grid> */}
    </Container>
  );
};

export default HomePage;
