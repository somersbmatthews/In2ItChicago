import { Injectable, HttpService } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AxiosResponse } from 'axios';
import { SearchBounds } from '../interfaces/searchBounds';
import { GeocodeDAL } from '@src/DAL/geocodeDAL';
import * as GeoPoint from 'geopoint';
import { readFileSync } from 'fs';
import * as GeoJsonGeometriesLookup from 'geojson-geometries-lookup';
import { AddressResult } from 'src/interfaces/addressResult';
import { sleep } from '../utilities';
import { GetGeocodeRequest } from '@src/DTO/getGeocodeRequest';
import { geocodeApiDelayMilliseconds } from '../settings';
import { GetGeocodeResponse } from '@src/DTO/getGeocodeResponse';
import { CoordPair } from '@src/interfaces/coordPair';
import { map } from 'lodash';

const geojsonData = readFileSync('./res/chicago_neighborhoods.geojson');
const geojsonContent = JSON.parse(geojsonData.toString());
const geoLookup = new GeoJsonGeometriesLookup(geojsonContent);

@Injectable()
export class GeocodeService {
    lastExecuted: Date;
    geocodeDAL: GeocodeDAL;

    constructor(private readonly httpService: HttpService) {
        this.lastExecuted = new Date();
        this.geocodeDAL = new GeocodeDAL();
    }
    async radiusSearch(request: GetGeocodeRequest, miles: number): Promise<SearchBounds> {
        let searchBounds: SearchBounds;
        const foundAddress = await this.geocodeDAL.getGeocode(request);
        if (foundAddress.lat && foundAddress.lon) {
            const point = new GeoPoint(parseFloat(foundAddress.lat), parseFloat(foundAddress.lon));
            const bounds = point.boundingCoordinates(miles);
            searchBounds = {
                minLat: Math.min(bounds[0]._degLat, bounds[1]._degLat),
                maxLat: Math.max(bounds[0]._degLat, bounds[1]._degLat),
                minLon: Math.min(bounds[0]._degLon, bounds[1]._degLon),
                maxLon: Math.max(bounds[0]._degLon, bounds[1]._degLon),
            };
        }
        return searchBounds;
    }

    async geoSearch(address: string): Promise<AddressResult | null> {
        const baseUrl = 'https://nominatim.openstreetmap.org/search';
        const diff = new Date().valueOf() - this.lastExecuted.valueOf();
        if (diff <= geocodeApiDelayMilliseconds) {
            await sleep(diff);
        }
        let response: AxiosResponse<CoordPair[]>;
        response = await this.httpService.get<CoordPair[]>(encodeURI(`${baseUrl}?q=${address}&format=json`)).toPromise();;

        this.lastExecuted = new Date();

        if (response.data.length === 0) {
            return null;
        }

        const data = response.data[0];
        const result: AddressResult = {
            address,
            lat: parseFloat(data.lat),
            lon: parseFloat(data.lon),
            neighborhood: null,
        };

        const geojsonPoint = { type: 'Point', coordinates: [data.lon, data.lat] };
        const matches = geoLookup.getContainers(geojsonPoint).features;
        if (matches.length > 0) {
            result.neighborhood = matches[0].properties.pri_neigh;
        }
        return result;
    }

    async getGeocode(query: GetGeocodeRequest): Promise<GetGeocodeResponse> {
        // if (!query) {
        //     throw new GeneralError('Query not supplied');
        // }
        // searching by address and neighborhood causes issues if the neighborhood doesn't match the address
        if (query.address && query.neighborhood) {
            delete query.neighborhood;
        }

        const result = await this.geocodeDAL.getGeocode(query);

        // Geocode already found in database. No need to query web service.
        // if (result.length > 0) {
        //     if (query.address) {
        //         result = result[0];
        //     }
        //     return context;
        // }
        if (result) {
            return result;
        }
        let webServiceResult: AddressResult | null = null;
        if (query.address) {
            webServiceResult = await this.geoSearch(query.address);
        }

        if (webServiceResult == null) {
            webServiceResult = {
                address: query.address,
                lat: null,
                lon: null,
                neighborhood: null,
            };
        }

        const val = await this.geocodeDAL.createGeocode(result);
    }
}
