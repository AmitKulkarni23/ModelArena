import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#6366f1" },
    secondary: { main: "#ec4899" },
    background: {
      default: "#fafafa",
      paper: "#ffffff",
    },
    success: { main: "#16a34a" },
    warning: { main: "#d97706" },
    error: { main: "#dc2626" },
  },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em" },
    h2: { fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.02em" },
    h3: { fontWeight: 600, lineHeight: 1.25, letterSpacing: "-0.01em" },
    h4: { fontWeight: 600, lineHeight: 1.3 },
    h5: { fontWeight: 700, lineHeight: 1.35 },
    h6: { fontWeight: 700, lineHeight: 1.4 },
    body1: { fontSize: "1rem", lineHeight: 1.6 },
    body2: { fontSize: "0.875rem", lineHeight: 1.55 },
    caption: { fontSize: "0.75rem", lineHeight: 1.5 },
    fontWeightBold: 700,
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          transition: "transform 0.12s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.12s ease, background-color 0.15s ease",
          "&:hover": { transform: "translateY(-1px)" },
          "&:active": { transform: "translateY(0px)" },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        body: { fontVariantNumeric: "tabular-nums" },
      },
    },
    MuiCssBaseline: {
      styleOverrides: `
        html {
          font-kerning: normal;
          font-optical-sizing: auto;
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            transition-duration: 0.01ms !important;
            animation-duration: 0.01ms !important;
          }
        }
      `,
    },
  },
});
