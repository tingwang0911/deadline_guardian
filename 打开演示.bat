@echo off
chcp 65001 >nul
set PATH=C:\Program Files\nodejs;%PATH%
node -e "const http=require('http'),fs=require('fs'),path=require('path');http.createServer((req,res)=>{let p=path.join('d:/work/trae/Trae_projects/Deadline Guardian',req.url==='/'?'demo.html':req.url);fs.readFile(p,(e,d)=>{if(e){res.writeHead(404);res.end('Not found')}else{res.writeHead(200);res.end(d)}})}).listen(8080,()=>{console.log('服务器已启动');setTimeout(()=>{require('child_process').exec('start http://localhost:8080')},1000)})"
pause