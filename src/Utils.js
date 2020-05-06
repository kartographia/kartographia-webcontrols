if(!com) var com={};
if(!com.kartographia) com.kartographia={};

//******************************************************************************
//**  Utils
//******************************************************************************
/**
 *   Provides a static list of methods used to help create maps
 *
 ******************************************************************************/

com.kartographia.utils = {


  //**************************************************************************
  //** getCoord
  //**************************************************************************
  /** Returns a coordinate from a given list of coordinates at a given date.
   *  If a coordinate is not found for the given date, then a interpolated
   *  coordinate is returned using Vicenty ellipsoidal calculations. This
   *  method requires the LatLon Geodesy library which is sourced as follows:
    <pre>
       <script type="module">
       import LatLon from './lib/geodesy/latlon-ellipsoidal-vincenty.js';
       window.getLatLon = function(lat, lon){
           return new LatLon(lat, lon);
       }
       </script>
   </pre>
   * @param coordinateList An array of [x,y,t] coordinates where x is longitude
   * in decimal degrees, y is latitude, and t is time in milliseconds
   * @param currTime Time in milliseconds
   * @return Coordinate represented as an array [x,y,t,bearing,speed]
   */
    getCoord: function(coordinateList, currTime){
        var currCoord = null;
        var nextCoord = null;
        var prevCoord = null;


      //Create a Vicenty LatLon coordinate using an x,y point
        var getLatLon = function(x, y){
            return window.getLatLon(y, x);
        };


      //Returns distance between 2 points in meters
        var getDistance = function(c1, c2){
            return c1.distanceTo(c2);
        };


      //Returns bearing between 2 points
        var getBearing = function(c1, c2){
            var bearing = c1.initialBearingTo(c2);
            return isNaN(bearing) ? 0 : bearing;
        };


      //Returns x,y coordinate
        var getCoordinate = function(p1, distance, bearing){
            var p2 = p1.destinationPoint(distance, bearing);
            return [p2.longitude, p2.latitude];
        };



        for (var j=0; j<coordinateList.length; j++){
            var coord = coordinateList[j];
            var t = coord[2];
            if (t>currTime){
                nextCoord = coord;
                if (j>0){
                    prevCoord = coordinateList[j-1];
                    var t2 = prevCoord[2];
                    if (t2==t){
                        currCoord = prevCoord;
                        if (j>1){
                            prevCoord = coordinateList[j-2];
                        }
                        else{
                            prevCoord = null;
                        }
                    }
                }
                break;
            }
        }

        if (prevCoord!=null){
            var c1 = getLatLon(prevCoord[0], prevCoord[1]); //[x, y]
            var t1 = prevCoord[2];
            var bearing;
            var speed;

            if (prevCoord.length<4){

                var c2;
                var t2;
                if (currCoord!=null){
                    c2 = getLatLon(currCoord[0], currCoord[1]);
                    t2 = currCoord[2];
                }
                else{
                    c2 = getLatLon(nextCoord[0], nextCoord[1]);
                    t2 = nextCoord[2];
                }

                var distance = getDistance(c1,c2); //meters
                var time = (t2-t1)/1000; //seconds
                speed = distance/time; //meters/second
                bearing = getBearing(c1, c2);
                prevCoord.push(bearing);
                prevCoord.push(speed);
            }
            else{
                bearing = prevCoord[3];
                speed = prevCoord[4];
            }

            var elapsedTime = (currTime-t1)/1000; //in seconds
            var distanceFromPrevPoint = speed*elapsedTime;
            try{
                currCoord = getCoordinate(c1, distanceFromPrevPoint, bearing);
                currCoord.push(currTime);
                currCoord.push(bearing);
                currCoord.push(speed);
            }
            catch(e){}
        }

        return currCoord;
    }

};