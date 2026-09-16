import { createBoardPresentationDto } from './board_presentation_contract.js';

export class BoardPresentationTransport {
    constructor({ sink = null } = {}) { this.sink = sink; }
    setSink(sink) { this.sink = sink; }
    build(readModel) { return createBoardPresentationDto(readModel); }
    publish(readModel) {
        const dto = this.build(readModel);
        if (!this.sink) return dto;
        if (typeof this.sink === "function") { this.sink(dto); return dto; }
        if (typeof this.sink.publishBoardPresentation === "function") {
            this.sink.publishBoardPresentation(dto);
            return dto;
        }
        throw new Error("INVALID_BOARD_PRESENTATION_SINK");
    }
}

export default BoardPresentationTransport;
