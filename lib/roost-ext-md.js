import roost from "https://cdn.jsdelivr.net/gh/WojtekCodesToday/roostjs@master/roost.min.mjs"

roost.extensions["md"] = {
    parseStr(str) {
        if (typeof str !== 'string') return "";

        function rawText(txt) {
            txt = txt.replace(/<center>([\s\S]*?)<\/center>/gi, '<div style="text-align:center">$1</div>');
            txt = txt.replace(/<div align="center">([\s\S]*?)<\/div>/gi, '<div style="text-align:center">$1</div>');

            txt = txt.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="roost-md-img">');
            
            txt = txt.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="roost-md-link">$1</a>');
            
            const urlRegex = /(?<!["=])(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
            return txt.replace(urlRegex, '<a href="$1">$1</a>');
        }

        const j = {};
        let counter = 0;
        const regex = /(`)([^`]+)\1|(\*\*|__)(.*?)\3|(\*|_)(.*?)\5|(~~)([^~]+)\7/g;

        let match;
        let lastIndex = 0;

        while ((match = regex.exec(str)) !== null) {
            const plainText = str.substring(lastIndex, match.index);
            if (plainText.length > 0) j[`span-${counter++}`] = { "child": rawText(plainText) };

            if (match[1] === '`') {
                j[`code-${counter++}`] = { "child": match[2], "class": "roost-md-inline-code" };
            } else if (match[3]) {
                j[`strong-${counter++}`] = { "child": roost.extensions.md.parseStr(match[4]) };
            } else if (match[5]) {
                j[`em-${counter++}`] = { "child": roost.extensions.md.parseStr(match[6]) };
            } else if (match[7]) {
                j[`del-${counter++}`] = { "child": roost.extensions.md.parseStr(match[8]) };
            }
            lastIndex = regex.lastIndex;
        }

        const remainingText = str.substring(lastIndex);
        if (remainingText.length > 0) j[`span-${counter++}`] = { "child": rawText(remainingText) };

        return Object.keys(j).length === 1 && Object.keys(j)[0].startsWith('span') ? j[Object.keys(j)[0]].child : j;
    },

    parse(md = "", options = {}) {
        const parseStr = (m) => roost.extensions.md.parseStr(m);
        const jhtml = {};
        let lineCounter = 0;

        const cr = (tag, obj) => {
            jhtml[`${tag}-${lineCounter++}`] = obj;
        };

        const lines = md.split(/\r?\n/);
        let i = 0;

        while (i < lines.length) {
            let line = lines[i];
            let trimmed = line.trim();

            if (trimmed === "" && !line.startsWith("  ")) { i++; continue; }

            if (trimmed.startsWith("```")) {
                let codeContent = [];
                i++;
                while (i < lines.length && !lines[i].trim().startsWith("```")) {
                    codeContent.push(lines[i]);
                    i++;
                }
                cr("pre", { "child": { "code-0": { "child": codeContent.join("\n") } }, "class": "roost-md-block-code" });
                i++; continue;
            }

            if (trimmed.startsWith(">")) {
                cr("blockquote", { "child": parseStr(trimmed.substring(1).trim()), "class": "roost-md-quote" });
                i++; continue;
            }

            const hMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
            if (hMatch) {
                cr(`h${hMatch[1].length}`, { "child": parseStr(hMatch[2]), "class": "roost-md-h" });
                i++; continue;
            }

            if (trimmed.startsWith("|") && lines[i + 1]?.trim().match(/^\|?[\s-|\d:]+\|?$/)) {
                let tableChild = {};
                let rowCount = 0;
                const parseRow = (row, tag) => {
                    let cells = row.split("|").filter((c, idx, arr) => (idx !== 0 && idx !== arr.length - 1) || c.trim() !== "");
                    let trChild = {};
                    cells.forEach((c, ci) => { trChild[`${tag}-${ci}`] = { "child": parseStr(c.trim()) }; });
                    return { [`tr-${rowCount++}`]: { "child": trChild } };
                };
                Object.assign(tableChild, parseRow(line, "th"));
                i += 2;
                while (i < lines.length && lines[i].trim().startsWith("|")) {
                    Object.assign(tableChild, parseRow(lines[i], "td"));
                    i++;
                }
                cr("table", { "child": tableChild, "class": "roost-md-table" });
                continue;
            }

            const listRegex = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
            if (line.match(listRegex)) {
                const parseList = (startIndex, baseIndent) => {
                    let listChild = {};
                    let liCount = 0;
                    let lastLiIndex = -1;

                    while (i < lines.length) {
                        let currLine = lines[i];
                        let match = currLine.match(listRegex);
                        if (!match) break;

                        let indent = match[1].length;
                        if (indent < baseIndent) break; 
                        
                        if (indent > baseIndent && lastLiIndex !== -1) {
                            // This is a nested list for the previous LI
                            let nested = parseList(i, indent);
                            let currentLi = listChild[`li-${lastLiIndex}`];
                            if (typeof currentLi.child === "string") {
                                currentLi.child = { "span-0": { "child": currentLi.child }, ...nested };
                            } else {
                                Object.assign(currentLi.child, nested);
                            }
                            continue; 
                        }

                        // Regular LI
                        let isOrdered = match[2].includes(".");
                        let content = match[3];
                        let liObj = { "class": "roost-md-li" };

                        if (content.startsWith("[ ] ")) {
                            liObj.child = { "input-0": { "type": "checkbox", "disabled": "true" }, "span-0": { "child": parseStr(content.substring(4)) } };
                        } else if (content.toLowerCase().startsWith("[x] ")) {
                            liObj.child = { "input-0": { "type": "checkbox", "checked": "true", "disabled": "true" }, "span-0": { "child": parseStr(content.substring(4)) } };
                        } else {
                            liObj.child = parseStr(content);
                        }

                        lastLiIndex = liCount;
                        listChild[`li-${liCount++}`] = liObj;
                        i++;
                    }
                    const listTag = lines[startIndex].trim().match(/^\d+\./) ? "ol" : "ul";
                    return { [`${listTag}-${lineCounter++}`]: { "child": listChild, "class": `roost-md-${listTag}` } };
                };

                const fullList = parseList(i, line.match(listRegex)[1].length);
                Object.assign(jhtml, fullList);
                continue;
            }

            if (trimmed === "---" || trimmed === "***") {
                cr("hr", {});
                i++; continue;
            }

            cr("p", { "child": parseStr(line) });
            i++;
        }
        return jhtml;
    }
};