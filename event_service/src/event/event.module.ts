import { Module, HttpService, HttpModule } from '@nestjs/common';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { GeocodeModule } from '@src/geocode/geocode.module';
import { GeocodeService } from '@src/geocode/geocode.service';

@Module({
    imports: [HttpModule, GeocodeModule],
    controllers: [EventController],
    providers: [GeocodeService, EventService],
    exports: [EventService],
})
export class EventModule {
    constructor(private readonly eventService: EventService) {}
}
