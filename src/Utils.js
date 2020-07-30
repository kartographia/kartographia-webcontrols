if(!kartographia) var kartographia={};

//******************************************************************************
//**  Utils
//******************************************************************************
/**
 *   Provides a static list of methods used to help create maps
 *
 ******************************************************************************/

kartographia.utils = {

  //**************************************************************************
  //** getTileCoordinate
  //**************************************************************************
  /** Returns the x,y coordinate of a map tile for a given lat/lon and zoom.
   *  Credit:
   *  https://github.com/chriswhong/map-tile-functions/blob/master/latLngToTileXY.js
   */
    getTileCoordinate : function(lat, lng, zoom) {

        var clip = function(n,minValue,maxValue) {
            return Math.min(Math.max(n, minValue), maxValue);
        };

        var latitude = clip(lat, -85.05112878, 85.05112878);
        var longitude = clip(lng, -180, 180);

        var x = (longitude + 180.0) / 360.0 * (1 << zoom);
        var y = (1.0 - Math.log(Math.tan(latitude * Math.PI / 180.0) + 1.0 / Math.cos(lat* Math.PI / 180)) / Math.PI) / 2.0 * (1 << zoom);


        var tileX = parseInt(Math.trunc(x));
        var tileY = parseInt(Math.trunc(y));
        return [tileX, tileY];
    },


  //**************************************************************************
  //** line2Polygon
  //**************************************************************************
  /** Creates a polygon around a linestring
   *  @param points [ [0, 0], [25, 25], [13, 13] ]
   *  @param thickness Either a number or an array of numbers representing
   *  widths for each line segment [ 5, 10, 15 ]
   */
    line2Polygon : function (points, thickness) {

      //Convert points into json notation
        var arr = [];
        for (var i=0; i<points.length; i++){
            var pt = points[i];
            arr.push({
                x: pt[0],
                y: pt[1]
            });
        }
        points = arr;



      //Convert thickness into an array as needed
        if (!isArray(thickness)){
            var t = thickness;
            thickness = [];
            for (var i=0; i<points.length; i++){
                thickness.push(t);
            }
        }



        function getOffsets(a, b, thickness) {
            var
                dx = b.x - a.x,
                dy = b.y - a.y,
                len = Math.sqrt(dx * dx + dy * dy),
                scale = thickness / (2 * len)
            ;
            return {
                x: -scale * dy,
                y:  scale * dx
            };
        }

        function getIntersection(a1, b1, a2, b2) {

            // directional constants
            var
                k1 = (b1.y - a1.y) / (b1.x - a1.x),
                k2 = (b2.y - a2.y) / (b2.x - a2.x);



            // if the directional constants are equal, the lines are parallel
            if (Math.abs(k1 - k2)<0.00001) {
                return;
            }

            // y offset constants for both lines
            var m1 = a1.y - k1 * a1.x;
            var m2 = a2.y - k2 * a2.x;

            // compute x
            var x = (m1 - m2) / (k2 - k1);

            // use y = k * x + m to get y coordinate
            var y = k1 * x + m1;

            return { x:x, y:y };
        }

        function isArray(obj){
            return (Object.prototype.toString.call(obj)==='[object Array]');
        }


        var
            off, off2,
            poly = [],
            isFirst, isLast,
            prevA, prevB,
            interA, interB,
            p0a, p1a, p0b, p1b
        ;

        for (var i = 0, il = points.length - 1; i < il; i++) {
            isFirst = !i;
            isLast = (i === points.length - 2);


            off = getOffsets(points[i], points[i+1], thickness[i]);
            off2 = getOffsets(points[i], points[i+1], thickness[i+1]);

            p0a = { x:points[i].x + off.x, y:points[i].y + off.y };
            p1a = { x:points[i+1].x + off2.x, y:points[i+1].y + off2.y };

            p0b = { x:points[i].x - off.x, y:points[i].y - off.y };
            p1b = { x:points[i+1].x - off2.x, y:points[i+1].y - off2.y };


            if (!isFirst) {
                interA = getIntersection(prevA[0], prevA[1], p0a, p1a);
                if (interA) {
                    poly.unshift(interA);
                }
                interB = getIntersection(prevB[0], prevB[1], p0b, p1b);
                if (interB) {
                    poly.push(interB);
                }
            }

            if (isFirst) {
                poly.unshift(p0a);
                poly.push(p0b);
            }

            if (isLast) {
                poly.unshift(p1a);
                poly.push(p1b);
            }

            if (!isLast) {
                prevA = [p0a, p1a];
                prevB = [p0b, p1b];
            }
        }


        for (var i=0; i<poly.length; i++){
            var pt = poly[i];
            poly[i] = [pt.x, pt.y];
        }
        poly.push(poly[0]);

        return poly;

    },



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

if(!com) var com={};
if(!com.kartographia) com.kartographia={};
com.kartographia.utils = kartographia.utils;