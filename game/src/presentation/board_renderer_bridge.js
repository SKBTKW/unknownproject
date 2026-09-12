import { BoardPresentationTransport } from './board_presentation_transport.js';
import { BoardInputDispatcher } from './board_input_dispatcher.js';

export class BoardRendererBridge {
    constructor({ presentationState, outputSink = null, inputHandlers = {} } = {}) {
        if (!presentationState) throw new Error("BOARD_PRESENTATION_STATE_REQUIRED");
        this.transport = new BoardPresentationTransport({ sink: outputSink });
        this.input = new BoardInputDispatcher({ presentationState, handlers: inputHandlers });
    }
    publish(readModel) { return this.transport.publish(readModel); }
    dispatch(command) { return this.input.dispatch(command); }
    setOutputSink(sink) { this.transport.setSink(sink); }
    setInputHandler(name, handler) { this.input.setHandler(name, handler); }
}

export default BoardRendererBridge;
