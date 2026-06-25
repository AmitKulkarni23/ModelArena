import React from "react";
import { AppBar as MuiAppBar, Toolbar, Typography, Button, Box } from "@mui/material";

export function AppBar() {
  return (
    <MuiAppBar position="sticky" elevation={1}>
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 700 }}>
          ModelArena
        </Typography>
        <Button
          color="inherit"
          onClick={() => (window.location.hash = "/")}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Home
        </Button>
      </Toolbar>
    </MuiAppBar>
  );
}
