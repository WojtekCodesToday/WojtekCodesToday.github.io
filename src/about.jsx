import { page } from "./_page.js";
export default {
    title: "About",
    render: () => {
      return (
        <>
            <h1>About Page</h1>
            <p>This was loaded without refreshing the page!</p>
            <a href="/">Go back Home</a>
            <a href="/test.html">Go back nowhere</a>
        </>
        );
    }
};