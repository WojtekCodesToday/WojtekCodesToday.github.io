//import roost from "roostjs";
import roost from "./roost2";
import raw from "./pages/raw/raw";
import FourOfFour from "./FourOfFour"
import jhtml, { jbody, load } from ".";

import main from "./pages/main/main";
import socials from "./pages/socials/socials";
import wojchan from "./pages/wojchan/wojchan";
const page = {
    url: "",
    pages: [],
    temp:JSON.parse(JSON.stringify(jhtml)),
    open(site, func) {
        !page.pages.includes(site) && page.pages.push(site);
        site == page.url && func();
    },
    nopen(func) {
        !page.pages.includes(page.url) && func();
    },
    load: {
        page(path){
            load.before();
            load.before = ()=>{};
            load.after = ()=>{};
            page.url = path;
            jbody.child = {}
            page.open("/", main);
            page.open("/socials", socials);
            page.open("/wojchan", wojchan);
            page.open("/raw", raw.page);
            
            page.nopen(FourOfFour);
            const rst = (location.hash=="#raw") ? raw.raw(jhtml) : roost.convert(jhtml);
            document.getElementById('root').innerHTML = rst;
            load.after();
        },
        dynamic(url){
            page.load.page(url);
            window.history.pushState(document.title, "", url);
            return false
        }
    }
};

export default page