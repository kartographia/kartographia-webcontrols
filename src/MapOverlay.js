if(!com) var com={};
if(!com.kartographia) com.kartographia={};

//******************************************************************************
//**  MapOverlay
//******************************************************************************
/**
 *   Used to overlay a custom canvas over the map. Requires Map, MapTile and
 *   the LatLon Geodesy library which is sourced as follows:
 <pre>
    <script type="module">
    import LatLon from './lib/geodesy/latlon-ellipsoidal-vincenty.js';
    window.getLatLon = function(lat, lon){
        return new LatLon(lat, lon);
    }
    </script>
</pre>
 *
 ******************************************************************************/

com.kartographia.MapOverlay = function(map) {

    var me = this;
    var mapTile;



  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){


      //Get width and height of the map
        var width = map.el.offsetWidth;
        var height = map.el.offsetHeight;


      //Get projection
        var projection = map.getProjection();


      //Get extents
        var _map = map.getMap();
        var view = _map.getView();
        var extent = view.calculateExtent(_map.getSize());
        var minX = extent[0];
        var minY = extent[1];
        var maxX = extent[2];
        var maxY = extent[3];



      //Get or create mapTile
        var mapOverlay = map.overlay;
        if (!mapOverlay){

            mapTile = new com.kartographia.MapTile(minX, minY, maxX, maxY, width, height, projection);
            var canvas = mapTile.getCanvas();
            canvas.style.position = "absolute";
            canvas.style.top = 0;
            canvas.style.width = "100%";
            canvas.style.height = "100%";
            map.el.appendChild(canvas);
            map.overlay = mapTile;
        }
        else{
            mapTile = map.overlay;
        }
    };


  //**************************************************************************
  //** remove
  //**************************************************************************
    this.remove = function(){
        var canvas = mapTile.getCanvas();
        map.el.removeChild(canvas);
        map.overlay = null;
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        mapTile.clear();
    };


  //**************************************************************************
  //** addPoint
  //**************************************************************************
  /** Used to add a point to the image
   */
    this.addPoint = function(lat, lon, color, size, label){
        mapTile.addPoint(lat, lon, color, size, label);
    };


  //**************************************************************************
  //** addLine
  //**************************************************************************
  /** Used to add a linestring to the image
   */
    this.addLine = function(coords, color, size){
        mapTile.addLine(coords, color, size);
    };


  //**************************************************************************
  //** addText
  //**************************************************************************
    this.addText = function(text, lat, lon, color, size){
        mapTile.addText(text, lat, lon, color, size);
    };


  //**************************************************************************
  //** renderTracks
  //**************************************************************************
    this.renderTracks = function(tracks, currTime, settings){
        if (!tracks) return;


        var tailLength = settings.tailLength; //in minutes
        var color = settings.color;
        var showDeviceID = settings.labels ? settings.labels.indexOf("device")>-1 : false;
        var showTelemetry = settings.labels ? settings.labels.indexOf("telemetry")>-1 : false;
        var mphFilter = settings.speed;
        if (mphFilter!=null){
            if (mphFilter.indexOf("-")===-1){
                mphFilter = [
                    0, parseFloat(mphFilter)
                ];
            }
            else{
                var arr = mphFilter.split("-");
                mphFilter = [
                    parseFloat(arr[0]), parseFloat(arr[1])
                ];
            }
        }


        for (var i=0; i<tracks.length; i++){
            var track = tracks[i];
            var currCoord = getCurrCoord(track, currTime);
            if (currCoord!=null){
                var lat = currCoord[1]; //y
                var lon = currCoord[0]; //x
                var bearing = currCoord[3];
                var speed = currCoord[4]; //meters/second
                var mph = speed!=null ? (speed*2.236936) : 0;
                if (mphFilter){
                    if (mph>=mphFilter[0] && mph<=mphFilter[1]){

                    }
                    else{
                        continue;
                    }
                }


              //Define label
                var label = null;
                if (showDeviceID==true){
                    label = track.id+"";
                }
                if (showTelemetry==true){
                    if (mph>0){
                        mph = round(mph);
                        if (mph==0) mph = 0.1;
                        mph += " mph";

                        if (label==null) label = mph;
                        else label += "\n" + mph;

                        if (bearing!=null){
                            label += ", bearing " + round(bearing);
                        }
                    }
                }



              //Draw currCoord
                mapTile.addPoint(lat, lon, color, 5, label);


              //Draw label
                //mapTile.addText(track.id, lat, lon, color, 20);


              //Draw tail
                if (bearing!=null || speed!=null){


                    var lineString = [[lat, lon]];
                    var prevLat = lat;
                    var prevLon = lon;
                    var t0 = currTime - (tailLength*60*1000);


                  //Generate list of known coordinates
                    var knownPoints = [];
                    for (var j=0; j<track.coords.length; j++){
                        var c = track.coords[j];
                        if (c[2]>=t0 && c[2]<currTime){
                            knownPoints.push(c);
                        }
                    }


                  //Interpolate coordinates
                    var t = currTime;
                    for (var t=currTime; t>=t0; t=t-(60*1000)){


                        var x = knownPoints.length;
                        for (var k=knownPoints.length-1; k>=0; k--){
                            var pt = knownPoints[k];
                            if (pt[2]>t){
                                lat = pt[1]; //y
                                lon = pt[0]; //x
                                if (lat!=prevLat && lon!=prevLon){
                                    lineString.push([lat, lon]);
                                    //mapTile.addText((lat+","+lon), lat, lon, "blue", 15);
                                }
                                x--;
                            }
                        }
                        knownPoints.length = x;


                        var c = getCurrCoord(track, t);
                        if (c){
                            lat = c[1]; //y
                            lon = c[0]; //x
                            if (lat!=prevLat && lon!=prevLon){
                                //mapTile.addText((lat+","+lon), lat, lon, "green", 10);
                                lineString.push([lat, lon]);
                            }
                            prevLat = lat;
                            prevLon = lon;
                        }
                    }


                  //Draw line
                    if (lineString.length>1)
                    mapTile.addLine(lineString, color, 1);
                }
            }


        }
    };


  //**************************************************************************
  //** getCurrCoord
  //**************************************************************************
    var getCurrCoord = function(track, currTime){
        return com.kartographia.utils.getCoord(track.coords, currTime);
    };


  //**************************************************************************
  //** round
  //**************************************************************************
  /** Rounds decimal to the nearest 10ths place.
   */
    var round = function(number){
        return Math.round( number * 10 ) / 10;
    };

    init();
};