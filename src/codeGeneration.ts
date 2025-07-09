import * as vscode from 'vscode';
import * as dotenv from "dotenv";
import * as path from "path";
import { GoogleGenAI } from "@google/genai";
import { getLastLines } from './utils';

dotenv.config({ path: path.join(__dirname, "../.env") });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    vscode.window.showErrorMessage("GEMINI_API_KEY is missing. Please set it in your environment variables.");
}

// Initialize the Google GenAI client
const ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY
});

// Debounce function: Returns a promise and delays execution
function debounce<T extends (...args: any[]) => Promise<any>>(func: T, delay: number): (...args: Parameters<T>) => Promise<ReturnType<T>> {
    let timeoutId: NodeJS.Timeout;
    let lastPromise: Promise<ReturnType<T>> | null = null;
    
    return (...args: Parameters<T>): Promise<ReturnType<T>> => {
        clearTimeout(timeoutId);
        
        return new Promise((resolve) => {
            timeoutId = setTimeout(async () => {
                lastPromise = func(...args);
                resolve(await lastPromise);
            }, delay);
        });
    };
}

async function fetchAISuggestion(document: vscode.TextDocument, position: vscode.Position): Promise<string> {
    const codeContext = getLastLines(document, position.line, 5);
    const cursorPrefix = document.lineAt(position.line).text.substring(0, position.character);
    
    const prompt = `
    Complete this code **without repeating existing text**.\n
    Only give the next part of the statement where the cursor is.\n
    Do NOT include explanations or comments.\n
    ---\n
    Previous Code:\n
    ${codeContext}\n
    ---\n
    Current Line Start:\n
    ${cursorPrefix}█  <-- (Cursor here)\n
    What comes next?
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: prompt
        });

        const textResponse = response.text?.trim() || "";
        
        if (!textResponse) {
            console.error("AI API returned an empty response");
            return "";
        }

        return textResponse;
    } catch (error) {
        console.error('AI API error:', error);
        return '';
    }
}

const debouncedGetAISuggestion = debounce(fetchAISuggestion, 500);

export async function getAISuggestion(document: vscode.TextDocument, position: vscode.Position): Promise<string> {
    return debouncedGetAISuggestion(document, position);
}
