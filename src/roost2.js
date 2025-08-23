const roost = {
    convert: (jhtml)=>{
        let html = "";
        if (typeof jhtml == "undefined") return html;
        for (let element in jhtml) {
            if (jhtml.hasOwnProperty(element)) {
                let tag = element.split("-")[0], id = element.split("-")[1];
                id = id==undefined?"0":id;
                
                let attributes =  jhtml[element], content = "";
                if (typeof attributes === "object") {
                    if (attributes.hasOwnProperty("child")) {                        
                        content = typeof attributes["child"] === "object" ? 
                        roost.convert(attributes["child"]) : attributes["child"];
                        
                        delete attributes["child"];
                    }
                    if (tag == ""){
                        html+=`${content}`    
                    } else {
                        let obj = `<${tag}`;
                        for (let attribute in attributes) {
                            if (attributes.hasOwnProperty(attribute)) {
                                let value = attributes[attribute];
                                /*if (typeof value === "string") {
                                    value = value.replace(/"/g, "&quot;");
                                }*/
                                obj += ` ${attribute}="${value}"`;
                            }
                        }
                        let r = `${obj}>${(typeof content === "undefined") ? "" : `${content}</${tag}>`}`;
                        html+=`${r/*.replace(`${obj}></${tag}>`, `${obj}>`)*/}`;
                    }
                }
            }
        }
        return html;
    },
    parse: (js) => {
        const h_htmlc = typeof js.html === "undefined" ? js : js.html.hasOwnProperty("child") ? js.html.child : js.html;
        const h_head = h_htmlc.head;
        const h_body = h_htmlc.body;
        const h_headc = typeof h_head === "undefined" ? js.head : h_head.hasOwnProperty("child") ? h_head.child : js.head;
        const h_bodyc = typeof h_head === "undefined" ? js.body : h_body.hasOwnProperty("child") ? h_body.child : js.body;
        return `<!DOCTYPE HTML><html lang="${typeof js.lang === "undefined" ? "en" : js.lang}">${h_headc && `<head><meta charset="UTF-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="viewport" content="width=device-width, initial-scale=1.0">${roost.convert(h_headc)}</head>`}${h_bodyc && `<body>${roost.convert(h_bodyc)}</body>`}</html>`;
    },
    compile: (js)=>roost.parse(js),
};

export default roost;