import { jbody } from ".";

function FourOfFour() {
    document.title = "404";
    jbody.child = {
        "h1-0": {
            "child": "404"
        },
        "small-1": {
            "child": {
                "-0":{
                    "child":"bad page, "
                },
                "a-1":{
                    "target": "_blank",
                    "child":"bad apple",
                    "href":"https://wojtekgame.is-a.dev/bad-apple"
                },
                "-1":{
                    "child":"."
                },
            }
        }
    }
    /*return (
        <>
            <Navbar />
            <h1>404</h1>
            <small>bad page,<a href="https://wojtekgame.is-a.dev/bad-apple" target="_blank"> bad apple</a>.</small>
        </>
    )*/
}

export default FourOfFour;