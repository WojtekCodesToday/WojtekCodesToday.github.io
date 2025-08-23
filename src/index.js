const jhtml = {
    "div-0":{
        "id": "navbar",
        "child": {
            "div-0": {
                "width": "50",
                "id": "logo",
                "class": "pf box2d"
            },
            "div-1": {
                "id": "navlinks",
                "child": {
                    "a-0": {
                        "href": "/",
                        "child": "Home"
                    },
                    "a-1": {
                        "href": "/socials",
                        "child": "Socials"
                    }
                }
            }
        }
    },
    "div-1":{
        "id": "content",
        "child": {}
    }
}
export let jbody = jhtml["div-1"];
export let jbodyb = jhtml["div-1"].child;

export const load = {
    before:function(){},
    after:function(){},
}

export default jhtml
/*
<div id="navbar">
            <Link to="/">
                <div width={50} id="logo" className="pf" />
            </Link>
            <div id="navlinks">
                <Link to="/socials">Socials</Link>
            </div>
        </div>*/