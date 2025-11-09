import { AppServer, AppSession, ViewType } from '@mentra/sdk';
import axios from 'axios'; 

const PACKAGE_NAME = process.env.PACKAGE_NAME ?? (() => { throw new Error('PACKAGE_NAME is not set in .env file'); })();
const MENTRAOS_API_KEY = process.env.MENTRAOS_API_KEY ?? (() => { throw new Error('MENTRAOS_API_KEY is not set in .env file'); })();
const PORT = parseInt(process.env.PORT || '3000');
const OPEN_ROUTE_SERVICE_API_KEY = process.env.OPEN_ROUTE_SERVICE_API_KEY ?? (() => { throw new Error('OPEN_ROUTE_SERVICE_API_KEY is not set in .env file'); })();

const DESTINATION_LAT = 60.1740; 
const DESTINATION_LNG = 24.9388;
const DESTINATION_NAME = "Oodi Helsinki"; 

function maneuverToArrow(type: number): string {
    switch (type) {
        case 1:
        case 9:
            return '↑'; 
        case 2:
        case 13:
            return '↗'; 
        case 3:
            return '→';
        case 4:
            return '↘';
        case 5:
            return '↶';
        case 6:
            return '↙';
        case 7:
            return '←';
        case 8:
            return '↖';
        case 10:
        case 11:
            return '⟳';
        case 12:
            return '🏁';
        default:
            return '·';
    }
}

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const lonDeltaRad = (lon2 - lon1) * Math.PI / 180;

    const y = Math.sin(lonDeltaRad) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(lonDeltaRad);

    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    bearing = (bearing + 360) % 360; 
    return bearing;
}

function degreesToCardinal(bearing: number): string {
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round(bearing / 45) % 8; 
    return directions[index];
}

async function getNextInstruction(
  currentLat: number, 
  currentLng: number, 
  destinationLat: number, 
  destinationLng: number
): Promise<{ instruction: string, distance: string, type: number }> {
    const url = "https://api.openrouteservice.org/v2/directions/foot"; 
    
    try {
        const response = await axios.get(url, {
            params: {
                start: `${currentLng},${currentLat}`,
                end: `${destinationLng},${destinationLat}`,
                format: 'geojson',
                instructions_format: 'text', 
                preference: 'recommended'
            },
            headers: { 
                'Accept': 'application/json',
                'Authorization': OPEN_ROUTE_SERVICE_API_KEY 
            }
        });

        const steps = response.data.features[0].properties.segments[0].steps;

        if (steps && steps.length > 0) {
            const nextStep = steps[0];
            const distanceKm = (nextStep.distance / 1000); 
            const distance = distanceKm < 0.2 ? `${(nextStep.distance).toFixed(0)} m` : `${distanceKm.toFixed(1)} km`;
            
            return {
                instruction: nextStep.instruction, 
                distance: distance,
                type: nextStep.type 
            };
        }
        return { instruction: "Arrived or no route data.", distance: "0 m", type: 12 };

    } catch (error) {
        console.error("OpenRouteService API failed:", (error as any).message);
        if (axios.isAxiosError(error) && error.response?.status === 401) {
             return { instruction: "Routing Error (401): Check API Key.", distance: "?", type: 0 };
        }
        return { instruction: "Routing error.", distance: "?", type: 0 };
    }
}

class ExampleMentraOSApp extends AppServer {
  
  private previousLocation: { lat: number; lng: number } | null = null; 
  private lastInstruction: { arrow: string, text: string } = { 
    arrow: '🎯', 
    text: `Navigating to ${DESTINATION_NAME}` 
  };
  private currentDirection: string = 'N/A'; 
  private isMapActive: boolean = false;

  constructor() {
    super({
      packageName: PACKAGE_NAME,
      apiKey: MENTRAOS_API_KEY,
      port: PORT,
    });
  }

  protected async onSession(session: AppSession, sessionId: string, userId: string): Promise<void> {
    
    session.layouts.showTextWall(this.lastInstruction.arrow + " " + this.lastInstruction.text);

    
    session.events.onHeadPosition(async (data) => {
        if (data.position === 'up') {
            this.isMapActive = true;
            
            const compassView = `
              -- DIRECTION OF TRAVEL --
              
                       ${this.currentDirection}
              
              (Look down for directions)
            `.trim();
            
            session.layouts.showTextWall(compassView, { view: ViewType.MAIN });

        } else if (data.position === 'down') {
            this.isMapActive = false;
            session.layouts.showTextWall(this.lastInstruction.arrow + " " + this.lastInstruction.text);
        }
    });

    
    const locationCleanup = await session.location.subscribeToStream(
        { 
            accuracy: 'high',     
        }, 
        async (location) => {
            const currentLat = location.lat;
            const currentLng = location.lng;
            
            if (this.previousLocation) {
                const bearing = calculateBearing(
                    this.previousLocation.lat,
                    this.previousLocation.lng,
                    currentLat,
                    currentLng
                );
                this.currentDirection = degreesToCardinal(bearing);
            }
            
            if (this.previousLocation && Date.now() % 10000 < 2000) { 
                
                const { instruction, distance, type } = await getNextInstruction(
                    currentLat,
                    currentLng,
                    DESTINATION_LAT,
                    DESTINATION_LNG
                );
                
                const arrow = maneuverToArrow(type);

                this.lastInstruction = { 
                    arrow: arrow, 
                    text: `${instruction} (${distance})` 
                }; 

                if (!this.isMapActive) {
                    session.layouts.showTextWall(this.lastInstruction.arrow + " " + this.lastInstruction.text);
                }
            }

            this.previousLocation = { lat: currentLat, lng: currentLng };
        }
    );
    
    session.events.onDisconnected(() => {
      locationCleanup();
      console.log('Session disconnected. Streams stopped.');
    });

    
    session.events.onGlassesBattery((data) => {
      console.log('Glasses battery:', data);
    })
  }
}

const app = new ExampleMentraOSApp();
app.start().catch(console.error);