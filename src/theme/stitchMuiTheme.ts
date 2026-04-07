import { createTheme } from "@mui/material/styles";

/** Stitch “MsgBuddy MUI Modern” / Buddy Soft UI — Material-style purple palette */
const primaryMain = "#4217f7";
const secondaryMain = "#652fe7";

export function createStitchMuiTheme(mode: "light" | "dark") {
  const isLight = mode === "light";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isLight ? primaryMain : "#9b94ff",
        contrastText: isLight ? "#ffffff" : "#121218",
      },
      secondary: {
        main: isLight ? secondaryMain : "#cabaff",
        contrastText: isLight ? "#ffffff" : "#121218",
      },
      error: {
        main: isLight ? "#b41340" : "#f74b6d",
      },
      background: {
        default: isLight ? "#f5f6f8" : "#121218",
        paper: isLight ? "#ffffff" : "#1a1a22",
      },
      text: {
        primary: isLight ? "#2c2f31" : "#e4e1e7",
        secondary: isLight ? "#595c5e" : "#9b9d9f",
      },
      divider: isLight ? "rgba(44, 47, 49, 0.12)" : "rgba(228, 225, 231, 0.12)",
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      fontFamily: ['"Inter"', "system-ui", "sans-serif"].join(","),
      h1: {
        fontFamily: ['"Manrope"', "system-ui", "sans-serif"].join(","),
        fontWeight: 600,
        letterSpacing: "-0.02em",
      },
      h2: {
        fontFamily: ['"Manrope"', "system-ui", "sans-serif"].join(","),
        fontWeight: 600,
        letterSpacing: "-0.02em",
      },
      h3: {
        fontFamily: ['"Manrope"', "system-ui", "sans-serif"].join(","),
        fontWeight: 600,
        letterSpacing: "-0.02em",
      },
      h4: {
        fontFamily: ['"Manrope"', "system-ui", "sans-serif"].join(","),
        fontWeight: 600,
        letterSpacing: "-0.015em",
      },
      h5: {
        fontFamily: ['"Manrope"', "system-ui", "sans-serif"].join(","),
        fontWeight: 600,
      },
      h6: {
        fontFamily: ['"Manrope"', "system-ui", "sans-serif"].join(","),
        fontWeight: 600,
      },
      button: { textTransform: "none", fontWeight: 600 },
    },
    components: {
      MuiSvgIcon: {
        styleOverrides: {
          root: {
            // Icons follow surrounding text color (DaisyUI / Tailwind)
            color: "inherit",
          },
        },
      },
    },
  });
}
