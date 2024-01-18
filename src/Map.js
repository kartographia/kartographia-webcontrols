if(!kartographia) var kartographia={};

//******************************************************************************
//**  Map
//******************************************************************************
/**
 *   Map component used to render layers of geographic information (e.g. points,
 *   lines, polygons, images, etc). This component is build using OpenLayers
 *   and has been tested with OpenLayers versions 3-8. The only other
 *   dependency is the JavaXT Web Components Library.
 *
 ******************************************************************************/

kartographia.Map = function(parent, config) {
    this.className = "com.kartographia.Map";

    var me = this;
    var defaultConfig = {
        basemap: "osm",

        layers: [],


      /** Used to specify the initial lat/lon center point of the map. Default
       *  is over Europe.
       */
        center: [45, 20], //lat, lon


      /** Used to specify the initial zoom level of the map. Default is 5.
       */
        zoom: 5,


      /** Used to specify the minimum zoom level. Default is 0.
       */
        minZoom: 0,


      /** Used to specify the maximum zoom level. Default is 19.
       */
        maxZoom: 19,


      /** If true, will allow intermediary zoom levels (e.g. 2.5, 3.1, etc).
       *  Default is false so the map can only zoom in and out using sepecific
       *  integer values (1, 2, 3, etc). Note that zooming to a specific
       *  extent
       */
        partialZoom: false,


      /** Style for individual elements within the component. Note that you can
       *  provide CSS class names instead of individual style definitions.
       */
        style: {
            info: { //general style for telemetry data (e.g. loading, coord readout, etc)
                background: "rgba(255, 255, 255, 0.5)",
                fontFamily: '"MS Sans Serif",tahoma,arial,helvetica,sans-serif',
                fontSize: "8pt",
                color: "rgba(0,0,0,0.85)",
                cursor: "default"
            },
            coord: { //style for individual coordinates in the coordDiv
                padding: "0 3px 0 0",
                margin: "0 0 0 -5px",
                overflowX: "hidden",
                width: "100px",
                textAlign: "right"
            }
        },


      /** Used to specify the format for the coordinate read-out. Options are
       *  "DMS" for degrees, minutes, seconds and "DD" for decimal degrees.
       */
        coordinateFormat: "DMS", //vs DD


        renderers: {
            zoomControl: null //replace with function as desired
        }
    };


    var map, viewport;
    var resizeListener;
    var mousePosition = [0,0];
    var disableTransform = false;
    //var geographic = new ol.proj.Projection("EPSG:4326");
    //var mercator = new ol.proj.Projection("EPSG:3857");
    var customProjections = {};
    var WKT = new ol.format.WKT();
    var drawingLayer = new ol.source.Vector();
    var featureLayer = new ol.layer.Vector({
        source: new ol.source.Vector({})
    });


    var statusDiv, coordDiv, xCoord, yCoord;
    var statusTimer;
    var navHistory = [];
    var navStep = -1;
    var undoRedo = false;
    var drawing = false;

    var defaultStroke = new ol.style.Stroke({
        color: '#3399cc',
        width: 1
    });

    var defaultFill = new ol.style.Fill({
        color: 'rgba(255, 255, 255, 0.4)'
    });



  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        if (typeof parent === "string"){
            parent = document.getElementById(parent);
        }
        if (!parent) return;


      //Clone the config so we don't modify the original config object
        var clone = {};
        merge(clone, config);


      //Remove basemap from clone to avoid merge issues
        var basemap = clone.basemap;
        if (basemap) delete clone.basemap;


      //Merge clone with default config
        merge(clone, defaultConfig);
        config = clone;


      //Add basemap back to the config
        if (basemap) config.basemap = basemap;


      //Create main div
        var mainDiv = createElement('div', parent, {
            position: "relative",
            height: "100%"
        });
        mainDiv.setAttribute("desc", me.className);
        me.el = mainDiv;


      //Create status div
        statusDiv = createElement('div', mainDiv, config.style.info);
        statusDiv.style.position = "absolute";
        statusDiv.style.left = 0;
        statusDiv.style.bottom = 0;
        statusDiv.style.zIndex = 1;


      //Create div for coordinate readout
        coordDiv = createElement('div', mainDiv, config.style.info);
        coordDiv.style.position = "absolute";
        coordDiv.style.right = 0;
        coordDiv.style.bottom = 0;
        coordDiv.style.zIndex = 1;

        xCoord = createElement('div', coordDiv, config.style.coord);
        xCoord.style.display = "inline-block";

        yCoord = xCoord.cloneNode();
        coordDiv.appendChild(yCoord);




      //Instantiate map
        var controls = ol.control.defaults;
        if (typeof controls === 'function') {} //ol <7
        else controls = controls.defaults; //ol >= 7

        var interactions = ol.interaction.defaults;
        if (typeof interactions === 'function') {} //ol <7
        else interactions = interactions.defaults; //ol >= 7

        map = new ol.Map({
            controls: controls({
                zoom: config.renderers.zoomControl ? false : true,
                attribution: false
            }),
            interactions : interactions({
                doubleClickZoom: false, //ol.interaction.DoubleClickZoom
                shiftDragZoom: false //ol.interaction.DragZoom
            }),
            target: mainDiv,
            view: new ol.View({
                center: ol.proj.transform([config.center[1], config.center[0]], 'EPSG:4326', 'EPSG:3857'),
                zoom: config.zoom,
                minZoom: config.minZoom,
                maxZoom: config.maxZoom,
                constrainResolution: config.partialZoom===true ? false: true,
                showFullExtent: true
            })
        });


//      //List interactions
//        map.getInteractions().forEach((interaction) => {
//
//        });


        viewport = map.getViewport();


      //Add custom zoom control as needed
        if (config.renderers.zoomControl){
            config.renderers.zoomControl(mainDiv);
        }


      //Add basemap
        if (config.basemap){
            me.addBaseMap(config.basemap, "basemap");
        }

      //Add layers
        if (config.layers){
            for (var i=0; i<config.layers.length; i++){
                addLayer(config.layers[i]);
            }
        }
        addLayer(featureLayer).set("name", "featureLayer");
        addLayer(new ol.layer.Vector({
            source: drawingLayer
        })).set("name", "drawingLayer");


      //Set default style
        var fill = new ol.style.Fill({
            color: [180, 0, 0, 1.0]
        });

        var stroke = new ol.style.Stroke({
          color: [180, 0, 0, 1],
          width: 1
        });
        var style = new ol.style.Style({
          image: new ol.style.Circle({
            fill: fill,
            stroke: stroke,
            radius: 3
          }),
          fill: fill,
          stroke: stroke
        });
        featureLayer.setStyle(style);



      //Watch for map move events
        map.on("moveend", function(){

          //Update navigation history
            if (undoRedo === false) {
                if (navStep < navHistory.length - 1) {
                    for (var i = navHistory.length - 1; i > navStep; i--) {
                        navHistory.pop();
                    }
                }
                navHistory.push({
                    extent: map.getView().calculateExtent(map.getSize()),
                    navStep: map.getSize(),
                    zoom: map.getView().getZoom()
                });
                navStep = navStep + 1;
            }

          //Call the onExtentChange listener
            me.onExtentChange();
        });


        var getCoordinate = function(evt){
            var coord = ol.proj.transform(evt.coordinate, me.getProjection(), "EPSG:4326");
            var x = coord[0];
            if (x<-180){
                while (x<-180){
                    x = x+360;
                }
            }
            else if (x>180){
                while (x>180){
                    x = x-360;
                }
            }
            coord[0] = x;
            return coord;
        };

        var getEvent = function(evt){
            var e = evt.originalEvent;
            e.pixel = evt.pixel;
            return e;
        };


      //Watch for mouse events
        map.on("pointerdown", function(evt){
            var coord = getCoordinate(evt);
            me.onMouseDown(coord[1], coord[0], getEvent(evt));
        });
        map.on("pointermove", function(evt){
            var coord = getCoordinate(evt);
            var lat = coord[1];
            var lon = coord[0];

            var dd = format(lat, coord[0]);
            xCoord.innerHTML = dd[1];
            yCoord.innerHTML = dd[0];

            mousePosition[0] = lat;
            mousePosition[1] = lon;

            me.onMouseMove(lat, lon, getEvent(evt));
        });
        map.on('singleclick', function(evt) {
            var coord = getCoordinate(evt);
            me.onMouseClick(coord[1], coord[0], getEvent(evt));
        });
        map.on('contextmenu', function(evt) {
            var coord = getCoordinate(evt);
            me.onMouseClick(coord[1], coord[0], getEvent(evt));
        });
        map.on('dblclick', function(evt) {
            if (!drawing){
                var coord = getCoordinate(evt);
                me.onDoubleClick(coord[1], coord[0], getEvent(evt));
            }
        });



      //Add resize listener after the map has been added to the DOM
        onRender(viewport, function(){

            var callback = function(){
                me.resize(true);
                resizeListener = addResizeListener(parent, me.resize);
            };

            var n = viewport.getElementsByTagName("canvas").length;
            if (n===0 || isNaN(n)){
                var timer;

                var checkWidth = function(){
                    var n = viewport.getElementsByTagName("canvas").length;
                    if (n===0 || isNaN(n)){
                        timer = setTimeout(checkWidth, 100);
                    }
                    else{
                        clearTimeout(timer);
                        if (callback) callback.apply(me, []);
                    }
                };

                timer = setTimeout(checkWidth, 100);
            }
            else{
                if (callback) callback.apply(me, []);
            }

        });
    };


  //**************************************************************************
  //** getCanvas
  //**************************************************************************
  /** Returns the canvas element in which the map is rendered
   */
    this.getCanvas = function(){
        return viewport.getElementsByTagName("canvas")[0];
    };


  //**************************************************************************
  //** back
  //**************************************************************************
  /** Navigates to the previous view extent and zoom level.
   */
    this.back = function(){
        if (navStep > 0) {
            undoRedo = true;
            map.getView().fit(navHistory[navStep - 1].extent, navHistory[navStep - 1].navStep);
            map.getView().setZoom(navHistory[navStep - 1].zoom);
            setTimeout(function() {
                undoRedo = false;
            }, 360);
            navStep = navStep - 1;
        }
    };


  //**************************************************************************
  //** back
  //**************************************************************************
  /** Navigates to the next view extent and zoom level.
   */
    this.next = function(){
        if (navStep < navHistory.length - 1) {
            undoRedo = true;
            map.getView().fit(navHistory[navStep + 1].extent, navHistory[navStep + 1].navStep);
            map.getView().setZoom(navHistory[navStep + 1].zoom);
            setTimeout(function() {
                undoRedo = false;
            }, 360);
            navStep = navStep + 1;
        }
    };


  //**************************************************************************
  //** getMap
  //**************************************************************************
  /** Returns the OpenLayers map object underpinning this class.
   */
    this.getMap = function(){
        return map;
    };


  //**************************************************************************
  //** getMousePosition
  //**************************************************************************
  /** Returns an array representing the most recent lat/lon mouse position in
   *  the map.
   */
    this.getMousePosition = function(){
        return mousePosition;
    };


  //**************************************************************************
  //** getStatusDiv
  //**************************************************************************
  /** Returns the DOM element containing the status readout
   */
    this.getStatusDiv = function(){
        return statusDiv;
    };


  //**************************************************************************
  //** getCoordinateDiv
  //**************************************************************************
  /** Returns the DOM element containing the coordinate readout
   */
    this.getCoordinateDiv = function(){
        return coordDiv;
    };


  //**************************************************************************
  //** setCoordinateFormat
  //**************************************************************************
  /** Used to update the coordinate format in the coordinate readout
   *  @param format DMS (Degrees, Minutes, Seconds), DD (Decimal Degrees)
   */
    this.setCoordinateFormat = function(format){
        config.coordinateFormat = format;
    };




  //**************************************************************************
  //** resize
  //**************************************************************************
    this.resize = function(silent){

      //Resize map
        map.updateSize();

      //Update canvas width/height style attributes as needed (no longer required in OL 6.x)
        var arr = viewport.getElementsByTagName("canvas");
        for (var i=0; i<arr.length; i++){
            var canvas = arr[i];
            if (hasStyle(canvas, "width") && hasStyle(canvas, "height")){
                var width = canvas.parentNode.offsetWidth;
                var height = canvas.parentNode.offsetHeight;
                canvas.style.width = width + "px";
                canvas.style.height = height + "px";
                if (disableTransform && hasStyle(canvas, "transform")){
                    canvas.style.transform = "";
                }
            }
        }

      //Fire onResize event
        if (silent!==true) me.onResize();
    };

    var hasStyle = function(el, key){
        var s = el.style[key];
        if (s) return s.length>0;
        return false;
    };


  //**************************************************************************
  //** zoomIn
  //**************************************************************************
    this.zoomIn = function(){
        zoom(true);
    };


  //**************************************************************************
  //** zoomOut
  //**************************************************************************
    this.zoomOut = function(){
        zoom(false);
    };


  //**************************************************************************
  //** zoom
  //**************************************************************************
    var zoom = function(zoomIn){
        var view = map.getView();
        var z = view.getZoom() + (zoomIn ? 1 : -1);
        view.animate({
            zoom: z,
            duration: 200
        });
    };


  //**************************************************************************
  //** getZoomLevel
  //**************************************************************************
  /** Returns the zoom level (number)
   */
    this.getZoomLevel = function(){
        return map.getView().getZoom();
    };

    this.setZoomLevel = function(i){
        if (isNaN(i)) return;
        map.getView().setZoom(i);
    };


  //**************************************************************************
  //** getResolution
  //**************************************************************************
  /** Returns the projection unit per pixel (e.g meters/pixel)
   */
    this.getResolution = function(){
        return map.getView().getResolution();
    };


  //**************************************************************************
  //** addProjection
  //**************************************************************************
  /** Used to add a map projection to the projection database. This method
   *  requires Proj4 (http://proj4js.org/)
   *  @param code Keyword for the projection (e.g. "ESRI:102008" for Albers)
   *  @param defs Proj4 projection definition. Example for Albers:
   *  "+proj=aea +lat_1=20 +lat_2=60 +lat_0=40 +lon_0=-96 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs"
   *  @param extent Optional. Example for Albers:
   *  [-18019909.21177587, -9009954.605703328, 18019909.21177587, 9009954.605703328]
   *  @param worldExtent Optional. Example for Albers: [-179.99, -89.99, 179.99, 89]
   */
    this.addProjection = function(code, defs, extent, worldExtent){
        if (typeof proj4 !== 'undefined'){
            proj4.defs(code, defs);
            ol.proj.proj4.register(proj4);

            customProjections[code] = new ol.proj.Projection({
                code: code,
                extent: extent,
                worldExtent: worldExtent
            });
        }
    };


  //**************************************************************************
  //** setProjection
  //**************************************************************************
  /** Used to update the current map projection.
   */
    this.setProjection = function(value){

      //Get new projection
        var projection;
        if (typeof value === "string"){
            projection = customProjections[value];
            if (!projection) projection = ol.proj.get(value);
        }
        else if (value instanceof ol.proj.Projection){
            projection = value;
        }
        else{
            return;
        }


      //Update view
        map.setView(new ol.View({
            projection: projection,
            constrainResolution: config.partialZoom===true ? false: true,
            showFullExtent: true
        }));
    };


  //**************************************************************************
  //** getProjection
  //**************************************************************************
  /** Returns a ol.proj.Projection object representing the current map
   *  projection.
   */
    this.getProjection = function(){
        return map.getView().getProjection();
    };


  //**************************************************************************
  //** getExtent
  //**************************************************************************
  /** Returns the geographic coordinates of the view extents as a WKT polygon
   *  in WGS84.
   */
    this.getExtent = function(){
        var view = map.getView();
        var extent = view.calculateExtent(map.getSize());
        var geom = ol.geom.Polygon.fromExtent(extent);

        var coords;
        geom = geom.transform(me.getProjection(), "EPSG:4326");
        extent = geom.getExtent();
        if (Math.abs(extent[0] - extent[2])>360){
            var s = extent[1];
            var n = extent[3];
            coords = [
                [-180, s], [-180, n], [180, n], [180, s], [-180, s]
            ];
        }
        else{
            coords = getCoords(geom, "EPSG:4326");
        }


        return getWKT(coords);
    };


  //**************************************************************************
  //** setExtent
  //**************************************************************************
    this.setExtent = function(extent, callback){
        if (extent){
            extent = getExtent(extent);
            var view = map.getView();
            try{
                view.fit(extent, map.getSize());
            }
            catch(e){
                console.log(e);
                //console.log(extent);
            }
        }
        if (callback!=null) callback.call();

        /*
        if (extent instanceof ol.Extent){
            view.fit(extent, map.getSize());
            if (callback!=null) callback.call(map);
        }
        else{
            if (extent.getType()==='Polygon'){
                view.fit(extent, map.getSize());
                if (callback!=null) callback.call(map);
            }
            else if (extent.getType()==='Point'){
                view.setCenter(extent.getCoordinates());
                if (callback!=null) callback.call(map);
            }
            else{

            }
        }
        */
    };


  //**************************************************************************
  //** containsExtent
  //**************************************************************************
    this.containsExtent = function(extent){
        extent = getExtent(extent);
        var mapExtent = map.getView().calculateExtent(map.getSize());
        return ol.extent.containsExtent(mapExtent, extent);
    };

    var getExtent = function(extent){
        if (typeof(extent) === 'string' || extent instanceof String){
            var feature = WKT.readFeature(extent);
            var geom = feature.getGeometry();
            geom.transform("EPSG:4326", me.getProjection());
            extent = geom.getExtent();
        }
        else{
            if (extent instanceof ol.geom.Geometry){
                //TODO: check if the extent is in the right projection
                extent = extent.getExtent();
            }
            else if (extent instanceof ol.Feature){
                var geom = extent.getGeometry();
                extent = geom.getExtent();
            }
        }
        return extent;
    };


  //**************************************************************************
  //** setCenter
  //**************************************************************************
    this.setCenter = function(lat, lon, zoomLevel){
        map.getView().setCenter(ol.proj.transform([lon, lat], "EPSG:4326", me.getProjection()));
        if (zoomLevel) map.getView().setZoom(zoomLevel);
    };


  //**************************************************************************
  //** getCenter
  //**************************************************************************
  /** Returns the lat/lon coordinate of the center of the map
   */
    this.getCenter = function(){
        var center = map.getView().getCenter();
        var coord = new ol.geom.Point(center).transform(me.getProjection(),"EPSG:4326").getCoordinates();
        return [coord[1], coord[0]];
    };


  //**************************************************************************
  //** onExtentChange
  //**************************************************************************
  /** Called whenever the map extents are changed.
   */
    this.onExtentChange = function(){};


  //**************************************************************************
  //** onResize
  //**************************************************************************
  /** Called whenever the map is resized
   */
    this.onResize = function(){};


  //**************************************************************************
  //** beforeLoad
  //**************************************************************************
  /** Called before a tile layer has started loading tiles.
   */
    this.beforeLoad = function(layer){};


  //**************************************************************************
  //** onLoad
  //**************************************************************************
  /** Called after a tile layer has finished loading all its tiles.
   */
    this.onLoad = function(layer){};


  //**************************************************************************
  //** onMouseMove
  //**************************************************************************
  /** Called whenever the mouse moves in the map
   */
    this.onMouseMove = function(lat, lon, e){};


  //**************************************************************************
  //** onMouseDown
  //**************************************************************************
  /** Called whenever the mouse down event is detected in the map
   */
    this.onMouseDown = function(lat, lon, e){};


  //**************************************************************************
  //** onMouseClick
  //**************************************************************************
  /** Called whenever the user clicks on the map
   */
    this.onMouseClick = function(lat, lon, e){};


  //**************************************************************************
  //** onDoubleClick
  //**************************************************************************
  /** Called whenever the user double clicks on the map
   */
    this.onDoubleClick = function(lat, lon, e){};


  //**************************************************************************
  //** onLayerChange
  //**************************************************************************
  /** Called whenever a layer is updated
   */
    this.onLayerChange = function(layer){};


  //**************************************************************************
  //** panTo
  //**************************************************************************
    this.panTo = function(extent, duration, callback){

        var view = map.getView();

        if (!isNaN(parseInt(duration))){
            var pan = ol.animation.pan({
              duration: duration,
              source: view.getCenter()
            });
            map.beforeRender(pan);
        }

        me.setExtent(extent, callback);
    };


  //**************************************************************************
  //** drawLine
  //**************************************************************************
  /** Used to draw a line on the map. The line is added to the drawingLayer.
   *  @param style Style definition (optional). See ol.style.Style for options.
   *  @param callback Function to call after the user has finished drawing.
   *  The callback should expect two parameters. Example:
   <pre>
        function(wkt, geom){}
   </pre>
   *  The wkt parameter is a well-known text representation of the rectangle
   *  in WGS84. The geom is a OpenLayers geometry object in the current map
   *  projection (e.g. EPSG:3857).
   */
    this.drawLine = function(style, callback){

        if (arguments.length===1 && style instanceof Function){
            callback = style;
            style = null;
        }

        if (!style) style = new ol.style.Style({
            stroke: defaultStroke
        });

        enableDraw('LineString', style, callback);
    };


  //**************************************************************************
  //** drawPolygon
  //**************************************************************************
  /** Used to draw a polygon on the map. The polygon is added to the
   *  drawingLayer.
   *  @param style Style definition (optional). See ol.style.Style for options.
   *  @param callback Function to call after the user has finished drawing.
   *  The callback should expect two parameters. Example:
   <pre>
        function(wkt, geom){}
   </pre>
   *  The wkt parameter is a well-known text representation of the polygon in
   *  WGS84. The geom is a OpenLayers geometry object in the current map
   *  projection (e.g. EPSG:3857).
   */
    this.drawPolygon = function(style, callback){

        if (arguments.length===1 && style instanceof Function){
            callback = style;
            style = null;
        }

        if (!style) style = new ol.style.Style({
            image: null, //removes ball/circle
            stroke: defaultStroke,
            fill: defaultFill
        });

        enableDraw('Polygon', style, callback);
    };


  //**************************************************************************
  //** drawRectangle
  //**************************************************************************
  /** Used to draw a rectangle on the map. The rectangle is added to the
   *  drawingLayer.
   *  @param style Style definition (optional). See ol.style.Style for options.
   *  @param callback Function to call after the user has finished drawing.
   *  The callback should expect two parameters. Example:
   <pre>
        function(wkt, geom){}
   </pre>
   *  The wkt parameter is a well-known text representation of the rectangle
   *  in WGS84. The geom is a OpenLayers geometry object in the current map
   *  projection (e.g. EPSG:3857).
   */
    this.drawRectangle = function(style, callback){

        if (arguments.length===1 && style instanceof Function){
            callback = style;
            style = null;
        }

        if (!style) style = new ol.style.Style({
            stroke: defaultStroke,
            fill: defaultFill
        });

        enableDraw('Rectangle', style, callback);
    };


  //**************************************************************************
  //** clearDrawings
  //**************************************************************************
  /** Used to remove all drawings from the drawingLayer.
   */
    this.clearDrawings = function(){
        drawingLayer.clear(true);
        disableDraw();
    };


  //**************************************************************************
  //** enableDraw
  //**************************************************************************
    var enableDraw = function(type, style, callback){
        disableDraw();
        drawing = true;



        var draw, startKey, endKey, onDraw;
        if (type==='Rectangle'){
            startKey = 'boxstart';
            endKey = 'boxend';
            draw = new ol.interaction.DragBox({
                condition: ol.events.condition.always, //noModifierKeys,
                style: style
            });

          //Add DragBox support for touch devices
            var _handleEvent = ol.interaction.DragBox.handleEvent;
            if (_handleEvent){
                draw.handleEvent = function(e) {
                    if (e.pointerEvent && e.pointerEvent.pointerType === 'touch') {
                        e.pointerEvent.pointerType = 'mouse';
                    }
                    return _handleEvent.apply(this, arguments);
                };
            }
            else{
                //???
            }

            onDraw = function(evt){
                var geom = evt.target.getGeometry();
                drawingLayer.addFeature(new ol.Feature({
                    geometry: geom
                }));
                var coords = getCoords(geom);
                var wkt = getWKT(coords);
                disableDraw();
                if (callback) callback.apply(me, [wkt, geom]);
            };

        }
        else{
            startKey = 'drawstart';
            endKey = 'drawend';
            draw = new ol.interaction.Draw({
                condition: ol.events.condition.always, //noModifierKeys,
                freehandCondition: function(){
                    return false;
                },
                source: drawingLayer,
                type: type,
                style: style
            });

            onDraw = function(evt){
                setTimeout(function() { //slight timeout required because...
                                        //drawend fires before the feature is added!


                  //Update style of the newly added feature
                    var feature = evt.feature;
                    feature.setStyle(style);


                  //Get geom and wkt
                    var wkt;
                    var geom = feature.getGeometry();
                    if (geom.getType()==='Polygon'){
                        var coords = getCoords(geom);
                        wkt = getWKT(coords);
                    }
                    else{
                        wkt = WKT.writeGeometry(
                            geom.clone().transform(me.getProjection(),"EPSG:4326")
                        );
                    }

                    disableDraw();
                    if (callback) callback.apply(me, [wkt, geom]);

                }, 100);
            };
        }


        draw.on(startKey, function(evt) {
            //drawingLayer.clear(true);
        });


        draw.on(endKey, function(evt) {

            onDraw(evt);
        });

        map.addInteraction(draw);
    };


  //**************************************************************************
  //** disableDraw
  //**************************************************************************
    var disableDraw = function(){
        map.getInteractions().forEach(function (interaction) {
            if (interaction instanceof ol.interaction.Draw ||
                interaction instanceof ol.interaction.DragBox) {
                map.removeInteraction(interaction);
            }
        });
        drawing = false;
    };


  //**************************************************************************
  //** addBaseMap
  //**************************************************************************
  /** Used to add a basemap. Basemap layers are added below all other layers.
   */
    this.addBaseMap = function(basemap, name){
        if (typeof basemap === "string"){
            var url = basemap.toLowerCase();
            if ((url.indexOf("{x}")>-1 && url.indexOf("{y}")>-1 && url.indexOf("{z}")>-1)){
                basemap = new ol.layer.Tile({
                    source: new ol.source.XYZ({
                        url: basemap
                    })
                });
            }
            else{
                if (url=='osm'){
                    basemap = new ol.layer.Tile({
                        source: new ol.source.OSM({
                            crossOrigin: null //had to add this to avoid CORS errors starting in Feb 2020
                        })
                    });
                }
            }
        }
        var lyr = addLayer(basemap, 0);
        if (name) lyr.set("name", name);
        return lyr;
    };


  //**************************************************************************
  //** addLayer
  //**************************************************************************
  /** Used to add a layer to the map
   *
   *  @param lyr A map layer (e.g. ol.layer.Tile or ol.layer.Vector).
   *
   *  @param idx An index value (integer). Layers are rendered on top of one
   *  another. You can specify the layer position by providing an index value
   *  starting with 0 (lowest layer). This parameter is optional. If an index
   *  is not defined, the layer will be added on top of the highest layer.
   *
   *  @return A layer object with custom functions including show(), hide(),
   *  isVisible(), and setOpacity(). Tile layers will include an additional
   *  refresh() function. Vector layers will include additional functions
   *  including addFeature(), getFeatures(), clear(), getExtent(), and
   *  updateExtents().
   */
    this.addLayer = function(lyr, idx){

      //Check if the vector and drawing layers are present
        var offset = 0;
        var layers = map.getLayers();
        layers.forEach((layer)=>{
            if (layer===featureLayer) offset++;
            else{
                if (layer.getSource()===drawingLayer) offset++;
            }
        });


      //Update index so that the layer appears below the vector and drawing layers
        var numLayers = layers.getLength();
        if (idx==null){
            idx = numLayers-offset;
        }
        else{
            if (idx>numLayers-offset) idx = idx-offset;
        }

        return addLayer(lyr, idx);
    };

    var addLayer = function(lyr, idx){
        if (lyr==null) return;

      //Add layer to the map
        if (idx!=null) map.getLayers().insertAt(idx, lyr);
        else map.addLayer(lyr);


      //Add custom methods directly to the layer
        var src = lyr.getSource();
        if (src instanceof ol.source.Vector){

          /** Used to add a feature to the layer
           *  @param feature Accepts a ol.Feature with a geometry in EPSG:3857,
           *  a ol.geom.Geometry in EPSG:3857, or a WKT geometry in EPSG:4326
           */
            lyr.addFeature = function(feature){
                try{
                    this.getSource().addFeature(getFeature(feature));
                }
                catch(e){
                    console.log(e);
                }
            };
            lyr.getFeatures = function(){
                return this.getSource().getFeatures();
            };
            lyr.clear = function(){
                this.getSource().clear(true);
            };
            lyr.getExtent = function(){
                try{
                   return this.getSource().getExtent();
                }
                catch(e){}
            };
            lyr.updateExtents = function(){
                updateExtents(this);
            };
            src.on("addfeature", function(){
                me.onLayerChange(lyr);
            });
            src.on("removefeature", function(){
                me.onLayerChange(lyr);
            });
            src.on("clear", function(){
                me.onLayerChange(lyr);
            });
        }
        else{
            lyr.clear = function(){};
            lyr.getExtent = function(){};
        }


      //Add custom show/hide methods
        lyr.show = function(duration, callback){
            if (isNaN(duration)){
                this.setVisible(true);
            }
            else{
                var finalOpacity = this.getOpacity();
                if (finalOpacity>0){
                    this.setOpacity(0);
                    this.setVisible(true);
                    fadeLayer(this, 0, finalOpacity, duration, callback);
                }
                else{
                    this.setVisible(true);
                    if (callback) callback.apply(me, [this]);
                }
            }
        };
        lyr.hide = function(duration, callback){
            if (isNaN(duration)){
                this.setVisible(false);
            }
            else{
                var initialOpacity = this.getOpacity();
                if (initialOpacity>0){
                    fadeLayer(this, initialOpacity, 0, duration, function(layer){
                        layer.setVisible(false);
                        layer.setOpacity(initialOpacity);
                        if (callback) callback.apply(me, [layer]);
                    });
                }
                else{
                    this.setVisible(false);
                    if (callback) callback.apply(me, [this]);
                }
            }
        };
        lyr.isVisible = function(){
            return this.getVisible();
        };


      //Override the setOpacity method to provide anmimation options
        lyr.setOpacity_ = lyr.setOpacity;
        lyr.setOpacity = function(opacity, duration, callback){
            if (isNaN(duration)){
                this.setOpacity_(opacity);
            }
            else{
                fadeLayer(this, this.getOpacity(), opacity, duration, callback);
            }
        };



      //Add custom listeners and methods to tile layers
        if (lyr instanceof ol.layer.Tile){

            var source = lyr.getSource();
            source.on('tileloadstart', function() { //["precompose", "prerender"]
                me.beforeLoad(lyr);
                clearTimeout(statusTimer);
                statusDiv.innerHTML = "Loading...";
            });

            source.on(['tileloadend','tileloaderror'], function() { //["postcompose", "postrender"]
                clearTimeout(statusTimer);
                statusTimer = setTimeout(function() {
                    statusDiv.innerHTML = "";
                    me.onLoad(lyr);
                }, 800);
            });

            lyr.refresh = function(){
                var source = this.getSource();
                source.tileCache.expireCache({});
                source.tileCache.clear();
                if (source.clear) source.refresh();
            };


          //Special case for layers with a custom getImageData() function used
          //to manipulate image tiles (e.g. render points)
            lyr.on(["precompose", "prerender", "postcompose", "postrender"], function(obj){


                var ctx = obj.context; //layer.getRenderer().context;
                if (ctx){
                    ctx.drawImage = function(){
                        var img = arguments[0];


                        var src = lyr.getSource();
                        if (src && src.urls && lyr.getImageData){
                            if (src.urls.length){

                              //Check if url matches pattern (weak implementation!)
                                var url = src.urls[0];
                                url = url.replace("/{x}","");
                                url = url.replace("/{y}","");
                                url = url.replace("/{z}","");
                                if (img.src.indexOf(url)>-1){

                                    //console.log(url, img.src);

                                    if (!img.png){
                                        img.png = true;


                                        var canvas = createElement('canvas');
                                        canvas.width = img.width;
                                        canvas.height = img.height;
                                        var ctx = canvas.getContext('2d');
                                        ctx.drawImage(img, 0, 0);
                                        var imageData = lyr.getImageData(img, ctx);
                                        if (imageData){
                                            ctx.putImageData(imageData, 0, 0);
                                        }
                                        img.png = img.cloneNode();
                                        img.png.src = canvas.toDataURL('image/png');

                                    }
                                    arguments[0] = img.png;

                                }
                            }
                        }


                        var drawImage = CanvasRenderingContext2D.prototype.drawImage;
                        return drawImage.apply(this, arguments);

                        //ctx.updatePixels.apply(this, arguments);
                    };
                }

            });

        }


      //Add layer listener to broadcast visibility changes
        lyr.on("change:visible", function(){
            me.onLayerChange(this);
        });


        return lyr;
    };


  //**************************************************************************
  //** getLayers
  //**************************************************************************
  /** Returns an array of layers, from highest to lowest. Note that layer
   *  groups will be represented as arrays.
   */
    this.getLayers = function(){
        return getLayers(map.getLayers());
    };

    var getLayers = function(list){
        var layers = [];
        list.forEach(function(layer) {
            if (layer instanceof ol.layer.Group) {
                layers.push(layer.getLayers());
            }
            else layers.push(layer);
        });
        return layers;
    };


  //**************************************************************************
  //** removeLayer
  //**************************************************************************
  /** Used to remove a layer from the map
   */
    this.removeLayer = function(lyr){
        map.removeLayer(lyr);
    };


  //**************************************************************************
  //** addFeature
  //**************************************************************************
    this.addFeature = function(feature){
        featureLayer.addFeature(getFeature(feature));
    };


  //**************************************************************************
  //** getFeature
  //**************************************************************************
    var getFeature = function(obj){
        if (obj instanceof ol.Feature){
            return obj;
        }
        else{


            var geom;
            if (obj!=null){
                if (obj.geom) geom = getGeometry(obj.geom); //json?
                else if (obj.geometry) geom = getGeometry(obj.geometry); //json?
                else geom = getGeometry(obj);
            }

            var f = new ol.Feature({ });
            if (geom) f.setGeometry(geom);
            return f;
        }
    };

    var getGeometry = function(geom){
        if (typeof geom === 'string' || geom instanceof String){
            var feature = WKT.readFeature(geom);
            geom = feature.getGeometry();
            geom.transform("EPSG:4326", me.getProjection());
            return geom;
        }
        else{
            if (geom instanceof ol.geom.Geometry){
                return geom;
            }
            else{
                return null;//???
            }
        }
    };


  //**************************************************************************
  //** clearFeatures
  //**************************************************************************
    this.clearFeatures = function(){
        featureLayer.getSource().clear();
    };


  //**************************************************************************
  //** createPointLayer
  //**************************************************************************
    this.createPointLayer = function(color, size){
        var layer = new ol.layer.Vector({
            source: new ol.source.Vector({}),
            style: getPointStyle(color, size),
            visible: true
        });
        me.addLayer(layer);
        updateExtents(layer);
        return layer;
    };

    var getPointStyle = function(color, size){

        if (typeof color === "string"){
            color = ol.color.asArray(color);
        }

        var fill = new ol.style.Fill({
            color: color
        });

        var stroke = new ol.style.Stroke({
            color: color,
            width: 0
        });

        return new ol.style.Style({
            image: new ol.style.Circle({
                fill: fill,
                stroke: stroke,
                radius: size
            }),
            fill: fill,
            stroke: stroke
        });
    };


  //**************************************************************************
  //** createVectorLayer
  //**************************************************************************
    this.createVectorLayer = function(color){

      //Create default style
        var defaultStyle;
        if (color){
            defaultStyle = new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: color,
                    width: 1
                })
            });
        }
        else{
            defaultStyle = new ol.layer.Vector().getStyleFunction()();
        }


      //Create layer
        var layer = new ol.layer.Vector({
            source: new ol.source.Vector({}),
            style: function(feature) {
                var style = feature.get("style");
                if (style) return style;

                var featureColor = feature.get("color");
                var fillColor = feature.get("fill");
                if (featureColor || fillColor){

                    var opt = {};
                    if (featureColor){
                        opt.stroke = new ol.style.Stroke({
                            color: featureColor,
                            width: 1
                        });
                    }
                    if (fillColor){
                        opt.fill = new ol.style.Fill({
                            color: fillColor
                        });
                    }

                    return new ol.style.Style(opt);
                }

                return defaultStyle;
            }
        });
        me.addLayer(layer);
        updateExtents(layer);
        return layer;
    };


  //**************************************************************************
  //** updateExtents
  //**************************************************************************
  /** Adds 2 transparent points to the given map layer. Used to circumvent a
   *  rendering bug in OpenLayers.
   */
    var updateExtents = function(layer){
        var src = layer.getSource();
        var style = new ol.style.Style({
            fill: new ol.style.Fill({
                color: ol.color.asString([0,0,0,0])
            })
        });
        src.addFeature(new ol.Feature({
            geometry: new ol.geom.Point([-20026376.39, -20048966.10]),
            style: style
        }));
        src.addFeature(new ol.Feature({
            geometry: new ol.geom.Point([20026376.39, 20048966.10]),
            style: style
        }));
    };


  //**************************************************************************
  //** getTilePreview
  //**************************************************************************
  /** Returns a url for an XYZ tile
   */
    this.getTilePreview = function(layer, coord, callback){
        if (!callback) return;

        var proj = ol.proj.get('EPSG:3857');
        var getPreview = function(){
            var tileUrlFunction = layer.getSource().getTileUrlFunction();
            var tileCoord = [3,2,3]; //Southeast coast of US, Carribean, and part of South America
            var preview = tileUrlFunction(tileCoord, 1, proj);
            if (preview){
              //The tileUrlFunction doesn't work correctly in OL5 for some reason.
              //For most XYZ tile sources, the y value is off. For OSM, Google, and
              //our local map server, the "3" y-value is replaced with a "-4".
              //To compensate, we'll replace the "-4" with a "3"
                if (preview.indexOf("-4")>-1){
                    preview = preview.replace("-4", "3"); //add hack to replace wierd -4 y coordinate
                }
            }
            return preview;
        };

        var preview = getPreview();
        if (preview){
            callback.apply(me, [preview]);
        }
        else{
            var timer;
            var checkPreview = function(){
                var preview = getPreview();
                if (preview){
                    clearTimeout(timer);
                    callback.apply(me, [preview]);
                }
                else{
                    timer = setTimeout(checkPreview, 1000);
                }
            };
            timer = setTimeout(checkPreview, 1000);
        }
    };


  //**************************************************************************
  //** getTileGeom
  //**************************************************************************
  /** Returns a WGS84 polygon representing the x,y,z tile coordinates.
   */
    this.getTileGeom = function(x,y,z){

        var north = tile2lat(y, z);
        var south = tile2lat(y + 1, z);
        var west = tile2lon(x, z);
        var east = tile2lon(x + 1, z);

        var ne = [east, north];
        var se = [east, south];
        var sw = [west, south];
        var nw = [west, north];
        var coords = [ne,nw,sw,se,ne];

        return new ol.geom.Polygon([coords]);
    };

    var tile2lon = function(x, z) {
        return x / Math.pow(2.0, z) * 360.0 - 180;
    };

    var tile2lat = function(y, z) {
        var n = Math.PI - (2.0 * Math.PI * y) / Math.pow(2.0, z);
        var radians = Math.atan(Math.sinh(n));
        //return Math.toDegrees(r);
        return radians * (180/Math.PI);
    };


  //**************************************************************************
  //** calculateNumberOfTiles
  //**************************************************************************
  /** Returns the total number of tiles required to fit the map view for a
   *  given tile source.
   */
    var calculateNumberOfTiles = function(tileSource) {
        var tg = (tileSource.getTileGrid()) ? tileSource.getTileGrid(): ol.tilegrid.getForProjection(map.getView().getProjection()),
            z = tg.getZForResolution(map.getView().getResolution()),
            tileRange = tg.getTileRangeForExtentAndZ(map.getView().calculateExtent(map.getSize()), z),
            xTiles = tileRange['maxX'] - tileRange['minX'] + 1,
            yTiles = tileRange['maxY'] - tileRange['minY'] + 1;
        return xTiles * yTiles;
    };


  //**************************************************************************
  //** fadeLayer
  //**************************************************************************
    var fadeLayer = function(layer, initialOpacity, finalOpacity, duration, callback, lastTick, timeLeft){

        if (!lastTick) lastTick = new Date().getTime();
        if (!timeLeft) timeLeft = duration;


        var curTick = new Date().getTime();
        var elapsedTicks = curTick - lastTick;



      //If the animation is complete, ensure that the layer is set to the finalOpacity
        if (timeLeft <= elapsedTicks){
            layer.setOpacity(finalOpacity);
            if (callback) callback.apply(me, [layer]);
            return;
        }


        timeLeft -= elapsedTicks;
        var percentComplete = 1-(timeLeft/duration);


        var opacity;
        var diff = Math.abs(initialOpacity-finalOpacity);
        if (initialOpacity<finalOpacity){
            opacity = initialOpacity+(diff*percentComplete);
        }
        else{
            opacity = initialOpacity-(diff*percentComplete);
        }


        layer.setOpacity(opacity);


        setTimeout(function(){
            fadeLayer(layer, initialOpacity, finalOpacity, duration, callback, curTick, timeLeft);
        }, 33);
    };


  //**************************************************************************
  //** getCoords
  //**************************************************************************
  /** Returns coordinates for a given geometry in WGS84. Shifts coordinates
   *  that cross the international dateline.
   *  @param proj Projection associated with the geometry. This parameter is
   *  optional and defaults to the current map projection.
   */
    var getCoords = function(geom, proj){

      //Clone the geometry
        geom = geom.clone();


      //Transform coordinates to WGS84
        if (!proj) proj = me.getProjection();
        if (proj!=="EPSG:4326") geom.transform(proj, "EPSG:4326");


      //Get offset
        var extent = geom.getExtent();
        var offset = 0;
        var minX = extent[0];
        if (minX<-180){
            while (minX<-180){
                minX = minX+360;
                offset+=360;
            }
        }
        else if (minX>180){
            while (minX>180){
                minX = minX-360;
                offset=offset-360;
            }
        }


      //Update coordinates
        var coords = geom.getCoordinates()[0];
        for (var i=0; i<coords.length; i++){
            var coord = coords[i];
            coord[0]+=offset;
        }
        return coords;
    };


  //**************************************************************************
  //** getWKT
  //**************************************************************************
  /** Returns wkt representation of a polygon
   */
    var getWKT = function(coords){
        var wkt = "POLYGON((";
        for (var i=0; i<coords.length; i++){
            if (i>0) wkt += ",";
            wkt += coords[i].join(" ");
        }
        wkt += "))";
        return wkt;
    };


  //**************************************************************************
  //** format
  //**************************************************************************
  /** Used to convert coordinates from decimal degrees to degrees, minutes,
   *  seconds
   */
    var format = function(lat, lon){

        if (lon>180){
            while (lon>360) lon = lon-360;
        }
        else if (lon<180){
            while (lon<-360) lon = lon+360;
        }

        if (lon>180) lon = -180-(180-lon);
        if (lon<-180) lon = 180+(lon+180);


        var latLabel = (lat>=0)?"N":"S";
        var lonLabel = (lon>=0)?"E":"W";


        if (config.coordinateFormat==="DMS"){

            var signlat = 1;
            if(lat < 0)  { signlat = -1; }
            var latAbs = Math.abs( Math.round(lat * 1000000.));

            var signlon = 1;
            if(lon < 0)  { signlon = -1; }
            var lonAbs = Math.abs( Math.round(lon * 1000000.));

            var latM = Math.floor(  ((latAbs/1000000) - Math.floor(latAbs/1000000)) * 60);
            var lonM = Math.floor(  ((lonAbs/1000000) - Math.floor(lonAbs/1000000)) * 60);

            if (latM<10) latM = "0" + latM;
            if (lonM<10) lonM = "0" + lonM;

            var latS = ( Math.floor(((((latAbs/1000000) - Math.floor(latAbs/1000000)) * 60) - Math.floor(((latAbs/1000000) - Math.floor(latAbs/1000000)) * 60)) * 100000) *60/100000 );
            var lonS = ( Math.floor(((((lonAbs/1000000) - Math.floor(lonAbs/1000000)) * 60) - Math.floor(((lonAbs/1000000) - Math.floor(lonAbs/1000000)) * 60)) * 100000) *60/100000 );


            if (latS<10) latS = "0" + latS;
            if (lonS<10) lonS = "0" + lonS;

            if (latS.toString().indexOf(".")<0) latS+=".0000";
            if (lonS.toString().indexOf(".")<0) lonS+=".0000";

            lat = ((Math.floor(latAbs / 1000000) * signlat) + "&deg;" + latM  + "'" + latS );
            lon = ((Math.floor(lonAbs / 1000000) * signlon) + "&deg;" + lonM  + "'" + lonS );


            var arr = (lat + '0000').split("\.");
            if (arr.length==2){
                arr[1] = arr[1].substring(0, 4);
                lat = arr[0] + "." + arr[1];
            }

            arr = (lon + '0000').split("\.");
            if (arr.length==2){
                arr[1] = arr[1].substring(0, 4);
                lon = arr[0] + "." + arr[1];
            }


            lat+="\" " + latLabel;
            lon+="\" " + lonLabel;
        }
        else{
            lat = round(lat, 9) + " " + latLabel;
            lon = round(lon, 9) + " " + lonLabel;
        }

/*
        xCoord.innerHTML = lon;
        yCoord.innerHTML = lat;
 */
        return [lat, lon];
    };



  //**************************************************************************
  //** round
  //**************************************************************************
    var round = function(value, decimalPlaces){
        return Number(Math.round(parseFloat(value + 'e' + decimalPlaces)) + 'e-' + decimalPlaces);
    };


  //**************************************************************************
  //** JavaXT Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;
    var createElement = javaxt.dhtml.utils.createElement;
    var addResizeListener = javaxt.dhtml.utils.addResizeListener;


    init();
};


if(!com) var com={};
if(!com.kartographia) com.kartographia={};
com.kartographia.Map = kartographia.Map;