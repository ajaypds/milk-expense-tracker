import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { Container } from "@mui/material";
import DailyEntryForm from "../components/DailyEntryForm";
import DailyEntriesTable from "../components/DailyEntriesTable";
import type { MilkEntry } from "../types";
import { fetchEntriesForPeriod, fetchAllEntries } from "../store/milkSlice";
import { getMonthPeriod } from "../utils/dateUtils";
import type { AppDispatch } from "../store/store";

const HomePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [editingEntry, setEditingEntry] = useState<MilkEntry | null>(null);

  return (
    <Container className="pt-4 ">
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
      <div className="mt-6"></div>
      <DailyEntriesTable onEdit={(entry) => setEditingEntry(entry)} />
      {/* </Paper> */}
      {/* <Grid>
      </Grid> */}
      {/* </Grid> */}
    </Container>
  );
};

export default HomePage;
