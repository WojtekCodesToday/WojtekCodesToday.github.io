let scr
function uiHandle(){
    if (!mangaData) return;
    
    const p0 = mangaData.p[0];
    const isManga = settings.mode === 0;
    const totalRows = isManga ? Math.ceil(mangaData.p.length / 2) : mangaData.p.length;
    const contentHeight = totalRows * p0.h * scale;
    scr = ((container.scrollTop>40*scale)?(contentHeight - container.scrollTop) + 50:20);
    previous.style.top = next.style.top = scr + "px";
    next.style.left = "65%";
    previous.style.left = "30%";
    //next.style.padding = previous.style.padding = (scale * 3.5) + "px";
}

render_call=uiHandle;