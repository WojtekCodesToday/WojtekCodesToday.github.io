const roost = {
    convert: (jhtml)=>{
        let html = "";
        if (typeof jhtml == "undefined") return html;
        for (let element in jhtml) {
            if (jhtml.hasOwnProperty(element)) {
                let tag = element.split("-")[0], id = element.split("-")[1];
                id = id==undefined?"0":id;
                let attributes = jhtml[element], content = "";
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
                                obj += ` ${attribute}="${value}"`;
                            }
                        }
                        html+=`${obj}>${(typeof content === "undefined") ? "" : `${content}</${tag}>`}`;
                    }
                }
            }
        }
        return html;
    },
    extensions:{}
};

export default roost;