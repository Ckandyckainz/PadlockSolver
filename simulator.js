// This code is intended to be able to solve the online number guessing game Padlock
// I did not create Padlock; it can be found here: https://www.padlockgame.net/
// I wrote this code on 10/10/2026
// Modified to work with WebGPU on 10/24/2026

let digitCount = 4; // number of places for numbers (usually 4 or 5)

let trueSolution = "";
let possibleGuesses = [];
let possibleSolutions = [];
let pastGuesses = [];

function newNumber(){
    pastGuesses = [];
    trueSolution = "".concat(Math.floor(Math.random()*10**digitCount)).padStart(digitCount, "0");
    possibleSolutions = [];
    for (let i=0; i<10**digitCount; i++) {
        possibleSolutions.push("".concat(i).padStart(digitCount, "0"));
    }
    possibleGuesses = possibleSolutions.slice();
}

async function runTrial(startingGuesses, solution){
    newNumber();
    if (solution != undefined) {
        trueSolution = solution;
    }
    console.log(trueSolution);
    let guessOn = 0;
    let done = false;
    while (!done && guessOn < 20) {
        let useStartingGuess = false;
        if (startingGuesses != undefined) {
            if (guessOn < startingGuesses.length) {
                useStartingGuess = true;
            }
        }
        let guess;
        if (useStartingGuess) {
            guess = startingGuesses[guessOn];
        } else {
            guess = await chooseGuess();
            pastGuesses.push(guess);
            guess = "".concat(guess).padStart(digitCount, "0");
        }
        let response = getGuessResponseResponse(guess, trueSolution);
        let guessResponse = {guess: guess, response: response};
        possibleSolutions = getPossibleSolutions(guessResponse);
        console.log(guessResponse, possibleSolutions.length);
        if (response.green == digitCount) {
            done = true;
        }
        guessOn ++;
    }
}

async function chooseGuess(){
    if (possibleSolutions.length <= 2) {
        return possibleSolutions[0];
    } else {
        return await chooseGuessByThinkingWebGPU(stringArrayToNumbers(possibleSolutions), digitCount, pastGuesses);
    }
}

function chooseGuessByThinking(){
    let bestGuessIndex = 0;
    let bestGuess = "";
    let bestGuessPrecision = Infinity; // precision is the number of words a guess narrows the solution down to
    for (let i=0; i<possibleGuesses.length; i++) {
        let guess = possibleGuesses[i];
        let currentGuessPrecision = getGuessPrecision(guess);
        if (currentGuessPrecision < bestGuessPrecision) {
            bestGuessIndex = i;
            bestGuess = guess;
            bestGuessPrecision = currentGuessPrecision;
        }
    }
    possibleGuesses.splice(bestGuessIndex, 1);
    return bestGuess;
}

function getGuessPrecision(guess){
    let worstGuessPrecision = 1;
    for (let green = 0; green < digitCount; green ++) {
        for (let yellow = 0; yellow <= digitCount-green; yellow ++) {
            let currentGuessPrecision = getPossibleSolutions({
                guess: guess,
                response: {green: green, yellow: yellow}
            }).length;
            if (currentGuessPrecision > worstGuessPrecision) {
                worstGuessPrecision = currentGuessPrecision;
            }
        }
    }
    return worstGuessPrecision;
}

function getPossibleSolutions(guessResponse){
    let localPossibleSolutions = [];
    for (let i=0; i<possibleSolutions.length; i++) {
        let solution = possibleSolutions[i];
        if (
            guessResponseResponsesEqual(
                getGuessResponseResponse(guessResponse.guess, solution),
                guessResponse.response
            )
        ) {
            localPossibleSolutions.push(solution);
        }
    }
    return localPossibleSolutions;
}

function getGuessResponseResponse(guess, solution){
    let greenDigits = "";
    for (let i=0; i<digitCount; i++) {
        if (guess[i] == solution[i]) {
            greenDigits += "".concat(guess[i]);
        }
    }
    let guessCopy = removeGuessDataOverlap(greenDigits, guess);
    let solutionCopy = removeGuessDataOverlap(greenDigits, solution);
    let yellow = 0;
    for (let i=0; i<guessCopy.length; i++) {
        let digit = guessCopy[i];
        for (let j=0; j<solutionCopy.length; j++) {
            if (solutionCopy[j] == digit) {
                solutionCopy = stringRemoveChar(solutionCopy, j);
                yellow ++;
                break;
            }
        }
    }
    return {green: greenDigits.length, yellow: yellow};
}

function removeGuessDataOverlap(green, guessData){
    let gd = guessData;
    for (let i=0; i<green.length; i++) {
        for (let j=0; j<gd.length; j++) {
            if (gd[j] == green[i]) {
                gd = stringRemoveChar(gd, j);
                break;
            }
        }
    }
    return gd;
}

function stringRemoveChar(string, index){
    return string.substring(0, index)+string.substring(index+1, string.length);
}

function guessResponseResponsesEqual(grr1, grr2){
    return grr1.green == grr2.green && grr1.yellow == grr2.yellow;
}

function stringArrayToNumbers(array){
    let numberArray = [];
    for (let i=0; i<array.length; i++) {
        numberArray.push(Number(array[i]));
    }
    return numberArray;
}