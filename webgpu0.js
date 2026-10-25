// File created 10/24/2026

// Sources of information:
// https://webgpufundamentals.org/webgpu/lessons/webgpu-fundamentals.html
// https://webgpufundamentals.org/webgpu/lessons/webgpu-compute-shaders.html (Note: I copied a little bit of code from this)
// https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/createBuffer
// https://webgpu.rocks/wgsl/language/types/


async function chooseGuessByThinkingWebGPU(possibleSolutions, digits, pastGuesses) {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const workgroupSize = 64;

    const shader1 = `
        @group(0) @binding(0)
        var<storage, read_write> buffer: array<u32>;
        @compute @workgroup_size(${workgroupSize})
        fn compute(@builtin(global_invocation_id) global_id : vec3u){
            var possibleResponsesCount = buffer[4];
            var possibleResponseIndex = global_id.x%possibleResponsesCount;
            var guess = (global_id.x-possibleResponseIndex)/possibleResponsesCount;
            possibleResponseIndex = buffer[0]+possibleResponseIndex*2;
            var guessGreen = buffer[possibleResponseIndex];
            var guessYellow = buffer[possibleResponseIndex+1];
            var possibleSolutionsCount = 0u;
            const digits = ${digits};
            for (var i=0u; i<buffer[5]; i++) {
                var solution = buffer[buffer[1]+i];
                var solutionGreen = 0u;
                var solutionYellow = 0u;
                var guessArray: array<u32, digits>;
                var solutionArray: array<u32, digits>;
                var guessCopy = guess;
                for (var j=0u; j<digits; j++) {
                    var guessDigit = guessCopy%10;
                    guessCopy = (guessCopy-guessDigit)/10;
                    var solutionDigit = solution%10;
                    solution = (solution-solutionDigit)/10;
                    if (solutionDigit == guessDigit) {
                        solutionGreen ++;
                        guessArray[j] = 10;
                        solutionArray[j] = 10;
                    } else {
                        guessArray[j] = guessDigit;
                        solutionArray[j] = solutionDigit;
                    }
                }
                if (solutionGreen == guessGreen) {
                    for (var j=0u; j<digits; j++) {
                        var guessDigit = guessArray[j];
                        for (var k=0u; k<digits; k++) {
                            if (guessDigit != 10 && guessDigit == solutionArray[k]) {
                                solutionArray[k] = 10;
                                solutionYellow ++;
                                break;
                            }
                        }
                    }
                    if (solutionYellow == guessYellow) {
                        possibleSolutionsCount ++;
                    }
                }
            }
            buffer[global_id.x+buffer[2]] = possibleSolutionsCount;
        }
    `

    const possibleResponsesCount = (digits+2)*(digits+1)/2-2;
    let bufferData = [6, possibleResponsesCount*2+6, possibleResponsesCount*2+possibleSolutions.length+6, digits, possibleResponsesCount, possibleSolutions.length];
    for (let green = 0; green < digits; green ++) {
        for (let yellow = 0; yellow <= digits-green; yellow ++) {
            if (!(green == digits-1 && yellow == 1)) {
                bufferData.push(green, yellow);
            }
        }
    }
    bufferData.push(...possibleSolutions);
    let bufferData2 = new Uint32Array(bufferData);
    let bufferSize = (10**digits*possibleResponsesCount+bufferData.length)*4 // in bytes
    let buffer = device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    let stagingBuffer = device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(buffer, 0, bufferData2, 0);

    const module = device.createShaderModule({code: shader1});
    const pipeline = device.createComputePipeline({
        label: 'compute pipeline',
        layout: 'auto',
        compute: {
        module,
        },
    });
    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{binding: 0, resource: buffer}]
    })
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(10**digits*possibleResponsesCount/workgroupSize));
    pass.end();
    encoder.copyBufferToBuffer(buffer, stagingBuffer, bufferSize);
    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    await device.queue.onSubmittedWorkDone();
    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const mappedRange = stagingBuffer.getMappedRange();
    const bufferAsArray = new Uint32Array(mappedRange).slice();
    //console.log(bufferAsArray);

    let data = bufferAsArray.slice(bufferAsArray[2]);
    let bestGuess = 0;
    let bestGuessPrecision = Infinity;
    for (let i=0; i<10**digits; i++) {
        let guessPrecision = 1;
        for (let j=0; j<possibleResponsesCount; j++) {
            let precision = data[i*possibleResponsesCount+j];
            if (precision > guessPrecision) {
                guessPrecision = precision;
            }
        }
        if (guessPrecision < bestGuessPrecision && guessPrecision != 0) {
            let alreadyGuessed = false;
            for (let j=0; j<pastGuesses.length; j++) {
                if (i == pastGuesses[j]) {
                    alreadyGuessed = true;
                    break;
                }
            }
            if (!alreadyGuessed) {
                bestGuessPrecision = guessPrecision;
                bestGuess = i;
            }
        }
    }
    return bestGuess;
}