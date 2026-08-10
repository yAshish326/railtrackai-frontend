import { createTheme } from "@mui/material/styles";

const theme = createTheme({

    palette: {

        primary: {

            main: "#1565C0"

        },

        secondary: {

            main: "#00897B"

        }

    },

    shape: {

        borderRadius: 10

    },

    typography: {
        fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }

});

export default theme;