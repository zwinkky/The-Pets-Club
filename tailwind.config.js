/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                // Change this hex to whatever you like
                appbg: "#f3b3c5a1",
            },
        },
    },
    plugins: [],
};
