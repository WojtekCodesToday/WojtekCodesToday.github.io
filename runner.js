const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if(process.argv.length > 2){
    const commands = fs.readFileSync(path.join(__dirname, process.argv[2]), 'utf-8')
                     .split('\n')
                     .map(cmd => cmd.trim())
                     .filter(cmd => cmd && !cmd.startsWith('#'));
                     
    commands.forEach(command => {
        console.log(`\n> ${command}\n`);
        execSync(command, { stdio: 'inherit' }); 
    });
    
}