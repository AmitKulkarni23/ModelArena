import React from "react";
import { AppBar as MuiAppBar, Toolbar, Typography, Button } from "@mui/material";

const MONO = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

export function AppBar() {
  return (
    <MuiAppBar
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: "#0f172a",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <Toolbar sx={{ minHeight: 52 }}>
        <Typography
          variant="h6"
          component="div"
          sx={{
            flexGrow: 1,
            fontWeight: 700,
            fontFamily: MONO,
            fontSize: "0.9375rem",
            letterSpacing: "-0.01em",
            color: "#fff",
            cursor: "pointer",
          }}
          onClick={() => { window.location.hash = "/"; }}
        >
          ModelArena
        </Typography>
        <Button
          onClick={() => { window.location.hash = "/"; }}
          sx={{
            textTransform: "none",
            fontWeight: 500,
            fontSize: "0.875rem",
            minHeight: 44,
            color: "rgba(255,255,255,0.6)",
            "&:hover": { color: "#fff", backgroundColor: "rgba(255,255,255,0.06)" },
          }}
        >
          Home
        </Button>
      </Toolbar>
    </MuiAppBar>
  );
}
