import React, { useState, useEffect } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline, Box } from "@mui/material";
import { theme } from "./theme";
import { BenchmarkProvider } from "./state/BenchmarkContext";
import { AppBar } from "./components/AppBar";
import { LandingPage } from "./pages/LandingPage";
import { BenchmarkCreatePage } from "./pages/BenchmarkCreatePage";
import { BenchmarkRunPage } from "./pages/BenchmarkRunPage";
import { BenchmarkResultsPage } from "./pages/BenchmarkResultsPage";

function useHashRoute(): string {
  const [route, setRoute] = useState(window.location.hash.slice(1) || "/");

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash.slice(1) || "/");
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return route;
}

function Router({ route }: { route: string }) {
  if (route === "/" || route === "") {
    return <LandingPage />;
  }
  if (route === "/benchmark/new") {
    return <BenchmarkCreatePage />;
  }
  if (route === "/benchmark/run") {
    return <BenchmarkRunPage />;
  }
  if (route === "/benchmark/results") {
    return <BenchmarkResultsPage />;
  }
  return <LandingPage />;
}

function App() {
  const route = useHashRoute();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BenchmarkProvider>
        <AppBar />
        <Box component="main">
          <Router route={route} />
        </Box>
      </BenchmarkProvider>
    </ThemeProvider>
  );
}

export default App;
