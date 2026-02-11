"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playSound = playSound;
const child_process_1 = require("child_process");
const config_1 = require("../config");
function playSound(speech) {
    const text = speech ? speech : config_1.config.token_buy.play_sound_text;
    const command = `powershell -Command "(New-Object -com SAPI.SpVoice).speak('${text}')"`;
    (0, child_process_1.exec)(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return false;
        }
        if (stderr) {
            console.error(`stderr: ${stderr}`);
            return false;
        }
        console.log("Speech executed successfully");
        return true;
    });
}
