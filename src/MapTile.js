if(!kartographia) var kartographia={};

//******************************************************************************
//**  MapTile
//******************************************************************************
/**
 *   Used to generate images that are rendered on a map. Can be used render
 *   points, lines, polygons, etc.
 *
 ******************************************************************************/

kartographia.MapTile = function(minX, minY, maxX, maxY, width, height, projection) {

    var me = this;
    var ULx = 0;
    var ULy = 0;
    var resX = 1;
    var resY = 1;
    var canvas, ctx;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){


      //Get canvas
        canvas = document.createElement('canvas');


      //Set width and height
        canvas.width = width;
        canvas.height = height;
        ctx = canvas.getContext('2d');




        if (projection=="EPSG:3857"){

            ULx = minX;
            ULy = maxY;


          //Compute pixelsPerDeg
            resX = width  / diff(maxX,minX);
            resY = height / diff(minY,maxY);

        }
        else if (projection=="EPSG:4326"){

          //Update min/max coordinates
            minX = x(minX);
            minY = y(minY);
            maxX = x(maxX);
            maxY = y(maxY);


          //Update Local Variables using updated values
            ULx = minX;
            ULy = maxY;


          //Compute pixelsPerDeg
            resX = width  / (maxX-minX);
            resY = height / (minY-maxY);//(maxY-minY);
        }

    };


  //**************************************************************************
  //** getCanvas
  //**************************************************************************
    this.getCanvas = function(){
        return canvas;
    };


  //**************************************************************************
  //** getImage
  //**************************************************************************
    this.getImage = function(){
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    };



  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };


  //**************************************************************************
  //** addPoint
  //**************************************************************************
  /** Used to add a point to the image
   */
    this.addPoint = function(lat, lon, color, size, label){


      //Get center point
        var x1 = x(lon);
        var y1 = y(lat);


      //Get upper left coordinate
        var r = size/2;
        //x1 = x1-r;
        //y1 = y1-r;


        ctx.beginPath();
        ctx.arc(x1, y1, r, 0, 2 * Math.PI, false);
        ctx.fillStyle = color;
        ctx.fill();

        if (label!=null){
            var arr = label.split("\n");
            var fontSize = 15;

            ctx.font = fontSize + "px Arial";
            ctx.fillText(arr[0], x1+r, y1);
            if (arr.length>1){
                ctx.font = "8px Arial";
                ctx.fillText(arr[1], x1+r, (y1+fontSize));
            }
        }

    };

  //**************************************************************************
  //** addLine
  //**************************************************************************
  /** Used to add a linestring to the image
   */
    this.addLine = function(coords, color, lineWidth){
        ctx.strokeStyle = color;
        if (lineWidth) ctx.lineWidth = lineWidth;
        ctx.beginPath();
        for (var i=0; i<coords.length; i++){
            var coord = coords[i];
            var lat = coord[0];
            var lon = coord[1];

            var x1 = x(lon);
            var y1 = y(lat);
            if (i==0) ctx.moveTo(x1,y1);
            else ctx.lineTo(x1,y1);
        }
        //ctx.closePath();
        ctx.stroke();
    };


  //**************************************************************************
  //** addPolygon
  //**************************************************************************
  /** Used to add a polygon to the image
   */
    this.addPolygon = function(coords, lineColor, fillColor, lineWidth){
        if (fillColor){
            ctx.fillStyle = fillColor;
            ctx.beginPath();
            for (var i=0; i<coords.length; i++){
                var coord = coords[i];
                var lat = coord[0];
                var lon = coord[1];

                var x1 = x(lon);
                var y1 = y(lat);
                if (i==0) ctx.moveTo(x1,y1);
                else ctx.lineTo(x1,y1);
            }
            ctx.closePath();
            ctx.fill();
        }
        if (lineColor) me.addLine(coords, lineColor, lineWidth);
    };


  //**************************************************************************
  //** addText
  //**************************************************************************
    this.addText = function(text, lat, lon, color, size){
      //Get center point
        var x1 = x(lon);
        var y1 = y(lat);
        ctx.fillStyle = color;
        ctx.font = size + "px Arial";
        ctx.fillText(text, x1, y1);
    };


  //**************************************************************************
  //** X
  //**************************************************************************
  /** Used to convert longitude to pixel coordinates
   */
    var x = function(pt){
        if (projection=="EPSG:3857"){
            var x = pt * 20037508.34 / 180;
            var d = diff(x,ULx);
            if (x<ULx) d = -d;
            //console.log(pt + "->" + x + "->" + d + "x" + resX);
            return d * resX;
        }
        else if (projection=="EPSG:4326"){
            pt += 180;
            var x = (pt - ULx) * resX;
            return x;
        }
    };



  //**************************************************************************
  //** Y
  //**************************************************************************
  /** Used to convert latitude to pixel coordinates
   */
    var y = function(pt){
        if (projection=="EPSG:3857"){
            var y = Math.log(Math.tan((90 + pt) * Math.PI / 360)) / (Math.PI / 180);
            y = y * 20037508.34 / 180;
            var d = diff(y,ULy);
            if (y>ULy) d = -d;
            //console.log(pt + "->" + y + "->" + d);
            return d * resY;
        }
        else if (projection=="EPSG:4326"){
            pt = -pt;
            if (pt<=0) pt = 90 + -pt;
            else pt = 90 - pt;

            pt = 180-pt;



            var y = (pt - ULy) * resY;

            if (cint(y)==0 || cint(y)==-0) y = 0;
            //else y = -y;


            return y;
        }
    };


    var cint = function(d){
        return Math.round(d);
    };

    var diff = function(a,b){
        return Math.abs(a-b);
    };

    init();
};



if(!com) var com={};
if(!com.kartographia) com.kartographia={};
com.kartographia.MapTile = kartographia.MapTile;