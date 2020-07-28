if(!kartographia) var kartographia={};

//******************************************************************************
//**  Map
//******************************************************************************
/**
 *   Thin wrapper for OpenLayers. Tested with versions 3-6
 *
 ******************************************************************************/

kartographia.Map = function(parent, config) {
    this.className = "com.kartographia.Map";

    var me = this;
    var viewport;
    var defaultConfig = {
        basemap: "osm",
        layers: [],
        center: [45, 20], //lat, lon
        zoom: 5, //initial zoom
        maxZoom: 19,
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
        coordinateFormat: "DMS" //vs DD
    };


    var map;
    //var geographic = new ol.proj.Projection("EPSG:4326");
    //var mercator = new ol.proj.Projection("EPSG:3857");
    var wktFormatter = new ol.format.WKT();
    var drawingLayer = new ol.source.Vector();
    var featureLayer = new ol.layer.Vector({
        source: new ol.source.Vector({})
    });


    var popup;
    var dragBox;
    var statusDiv, coordDiv, xCoord, yCoord;
    var navHistory = [];
    var navStep = -1;
    var undoRedo = false;
    var drawing = false;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
  /** Creates a new instance of this class. */

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
        var mainDiv = document.createElement('div');
        mainDiv.style.position = "relative";
        mainDiv.style.height = "100%";
        mainDiv.setAttribute("desc", me.className);
        parent.appendChild(mainDiv);
        me.el = mainDiv;





      //Create status div
        statusDiv = document.createElement('div');
        setStyle(statusDiv, config.style.info);
        statusDiv.style.position = "absolute";
        statusDiv.style.left = 0;
        statusDiv.style.bottom = 0;
        statusDiv.style.zIndex = 1;
        mainDiv.appendChild(statusDiv);


      //Create div for coordinate readout
        coordDiv = document.createElement('div');
        setStyle(coordDiv, config.style.info);
        coordDiv.style.position = "absolute";
        coordDiv.style.right = 0;
        coordDiv.style.bottom = 0;
        coordDiv.style.zIndex = 1;
        mainDiv.appendChild(coordDiv);

        xCoord = document.createElement('div');
        setStyle(xCoord, config.style.coord);
        xCoord.style.display = "inline-block";
        coordDiv.appendChild(xCoord);
        yCoord = xCoord.cloneNode();
        coordDiv.appendChild(yCoord);




      //Instantiate map
        map = new ol.Map({
            controls: ol.control.defaults({
                attribution: false
            }),
            interactions : ol.interaction.defaults({doubleClickZoom :false}),
            target: mainDiv,
            view: new ol.View({
                center: ol.proj.transform([config.center[1], config.center[0]], 'EPSG:4326', 'EPSG:3857'),
                zoom: config.zoom,
                maxZoom: config.maxZoom,
                constrainResolution: true
            })
        });
        viewport = map.getViewport();


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



      //Add popup
        if (typeof ol.Overlay.Popup !== 'undefined'){
            popup = new ol.Overlay.Popup();
            map.addOverlay(popup);
        }


      //Create DragBox interaction
        dragBox = new ol.interaction.DragBox({
            condition: ol.events.condition.always, //noModifierKeys,
            style: new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: [0, 0, 255, 1]
                })
            })
        });
        dragBox.setActive(false);

        dragBox.on('boxstart', function (evt) {
            drawing = true;
            drawingLayer.clear(true);
        });

        dragBox.on('boxend', function (evt) {
            drawing = false;
            var geom = evt.target.getGeometry();
            var feat = new ol.Feature({
                geometry: geom.clone()
            });
            drawingLayer.addFeature(feat);
            geom = geom.clone().transform('EPSG:3857','EPSG:4326');
            var wkt = wktFormatter.writeGeometry(geom);
            me.onBoxSelect(wkt, geom.getCoordinates());
        });


      //Add DragBox support for touch devices
        var _handleEvent = ol.interaction.DragBox.handleEvent;
        if (_handleEvent){
            dragBox.handleEvent = function(e) {
                if (e.pointerEvent && e.pointerEvent.pointerType === 'touch') {
                    e.pointerEvent.pointerType = 'mouse';
                }
                return _handleEvent.apply(this, arguments);
            };
        }
        else{
            //???
        }


      //Add DragBox to the map
        map.addInteraction(dragBox);


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
            return ol.proj.transform(evt.coordinate, 'EPSG:3857', 'EPSG:4326');
        };


      //Watch for mouse events
        map.on("pointermove", function(evt){
            var coord = getCoordinate(evt);
            format(coord[1], coord[0]);
            me.onMouseMove(coord[1], coord[0]);
        });
        map.on('singleclick', function(evt) {
            var coord = getCoordinate(evt);
            me.onMouseClick(coord[1], coord[0], evt.originalEvent);
        });
        map.on('contextmenu', function(evt) {
            var coord = getCoordinate(evt);
            me.onMouseClick(coord[1], coord[0], evt.originalEvent);
        });
        map.on('dblclick', function(evt) {
            if (!drawing){
                var coord = getCoordinate(evt);
                me.onDoubleClick(coord[1], coord[0]);
            }
        });



      //Add resize listener after the map has been added to the DOM
        onRender(viewport, function(){

            var callback = function(){
                me.resize();
                addResizeListener(parent, me.resize);
            };

            var w = viewport.getElementsByTagName("canvas").length;
            if (w===0 || isNaN(w)){
                var timer;

                var checkWidth = function(){
                    var w = viewport.getElementsByTagName("canvas").length;
                    if (w===0 || isNaN(w)){
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
  //** updateSize
  //**************************************************************************
  /** @deprecated Use resize method instead.
   */
    this.updateSize = function(){
        me.resize();
    };


  //**************************************************************************
  //** updateSize
  //**************************************************************************
    this.resize = function(){

      //Resize map
        map.updateSize();

      //Update canvas width/height style attributes (some browsers don't like 100%)
        var canvas = me.getCanvas();
        var width = canvas.parentNode.offsetWidth;
        var height = canvas.parentNode.offsetHeight;
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
    };


  //**************************************************************************
  //** getZoomLevel
  //**************************************************************************
  /** Returns the zoom level (int)
   */
    this.getZoomLevel = function(){
        return map.getView().getZoom();
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
  //** getProjection
  //**************************************************************************
  /** Returns the projection code for the current view (e.g. "EPSG:3857")
   */
    this.getProjection = function(){
        return map.getView().getProjection().getCode();
    };


  //**************************************************************************
  //** getExtent
  //**************************************************************************
  /** Returns the geographic coordinates of the view extents as WKT.
   */
    this.getExtent = function(){
        var view = map.getView();
        var extent = view.calculateExtent(map.getSize());
        var geom = ol.geom.Polygon.fromExtent(extent);
        return wktFormatter.writeGeometry(geom.clone().transform('EPSG:3857','EPSG:4326'));
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
            var feature = wktFormatter.readFeature(extent);
            var geom = feature.getGeometry();
            geom.transform('EPSG:4326', 'EPSG:3857');
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
        map.getView().setCenter(ol.proj.transform([lon, lat], 'EPSG:4326', 'EPSG:3857'));
        if (zoomLevel) map.getView().setZoom(zoomLevel);
    };


  //**************************************************************************
  //** getCenter
  //**************************************************************************
  /** Returns the lat/lon coordinate of the center of the map
   */
    this.getCenter = function(){
        var center = map.getView().getCenter();
        var coord = new ol.geom.Point(center).transform('EPSG:3857','EPSG:4326').getCoordinates();
        return [coord[1], coord[0]];
    };


  //**************************************************************************
  //** onExtentChange
  //**************************************************************************
  /** Called whenever the map extents are changed.
   */
    this.onExtentChange = function(){};


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
    this.onMouseMove = function(lat, lon){};


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
    this.onDoubleClick = function(lat, lon){};


  //**************************************************************************
  //** onSelect
  //**************************************************************************
  /** Called whenever a feature is selected on the map
   */
    this.onSelect = function(){};


  //**************************************************************************
  //** onBoxSelect
  //**************************************************************************
  /** Called whenever the client finishes a box select
   */
    this.onBoxSelect = function(wkt, coords){};


  //**************************************************************************
  //** panTo
  //**************************************************************************
    this.panTo = function(extent, duration, callback){

        var view = map.getView();

        if (duration!=null){
            var pan = ol.animation.pan({
              duration: duration,
              source: view.getCenter()
            });
            map.beforeRender(pan);
        }

        me.setExtent(extent, callback);
    };


  //**************************************************************************
  //** popup
  //**************************************************************************
  /** Used to render a popup/callout box on the map.
   *  @param coordinate Either a WKT representing a point or an array with
   *  lon/lat values in EPSG:3857.
   */
    this.popup = function(coordinate, html){
        if (typeof(coordinate) === 'string' || coordinate instanceof String){
            var feature = wktFormatter.readFeature(coordinate);
            coordinate = feature.getGeometry();
            coordinate.transform('EPSG:4326', 'EPSG:3857');
            coordinate = coordinate.getCoordinates();
        }
        popup.show(coordinate, html);
    };


  //**************************************************************************
  //** hidePopup
  //**************************************************************************
  /** Used to hide the popup/callout box on the map.
   */
    this.hidePopup = function(){
        popup.hide();
    };


  //**************************************************************************
  //** enableBoxSelect
  //**************************************************************************
    this.enableBoxSelect = function(){
        if (arguments.length===1 && arguments[0]===false) dragBox.setActive(false);
        else dragBox.setActive(true);
    };


  //**************************************************************************
  //** clearBoxSelect
  //**************************************************************************
    this.clearBoxSelect = function(){
        me.clearDrawings();
    };


  //**************************************************************************
  //** drawLine
  //**************************************************************************
  /** Allows users to interactively draw a linestring on the map
   */
    this.drawLine = function(style, callback){

        if (style==null) style = new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: '#3399cc',
                width: 1
            })
        });

        enableDraw('LineString', style, callback);
    };


  //**************************************************************************
  //** drawPolygon
  //**************************************************************************
  /** Allows users to interactively draw a polygon on the map
   */
    this.drawPolygon = function(style, callback){

        if (style==null) style = new ol.style.Style({
            image: null, //removes ball/circle
            stroke: new ol.style.Stroke({
                color: '#3399cc',
                width: 1
            }),
            fill: new ol.style.Fill({
                color: 'rgba(255, 255, 255, 0.4)'
            })
        });

        enableDraw('Polygon', style, callback);
    };


  //**************************************************************************
  //** clearDrawings
  //**************************************************************************
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
        var draw = new ol.interaction.Draw({
            source: drawingLayer,
            type: type,
            style: style
        });
        draw.on('drawstart', function (evt) {
            drawingLayer.clear(true); //mimics boxstart
        });
        draw.on('drawend', function(evt) {
            setTimeout(function() { //slight timeout required because...
                                    //drawend fires before the feature is added!

                var geom = evt.feature.getGeometry();
                geom = geom.clone().transform('EPSG:3857','EPSG:4326');
                var wkt = wktFormatter.writeGeometry(geom);
                disableDraw();
                if (callback) callback.apply(me, [wkt, geom]);

            }, 100);
        });
        map.addInteraction(draw);
    };


  //**************************************************************************
  //** disableDraw
  //**************************************************************************
    var disableDraw = function(){
        map.getInteractions().forEach(function (interaction) {
            if (interaction instanceof ol.interaction.Draw) {
                map.removeInteraction(interaction);
            }
        });
        drawing = false;
    };


  //**************************************************************************
  //** addBaseMap
  //**************************************************************************
    this.addBaseMap = function(basemap, name){
        if (typeof basemap === "string"){
            var url = basemap.toLowerCase();
            if ((url.indexOf("{x}")>-1 && url.indexOf("{y}")>-1 && url.indexOf("{z}")>-1)){
                basemap = new ol.layer.Tile({
                    source: new ol.source.XYZ({
                        url: basemap
                    })
                })
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
    this.addLayer = function(lyr, idx){

      //Update index so that the layer appears below the vector and drawing layers
        var numLayers = map.getLayers().getLength();
        if (idx==null){
            idx = numLayers-2;
        }
        else{
            if (idx>numLayers-2) idx = idx-2;
        }

        return addLayer(lyr, idx);
    };

    var addLayer = function(lyr, idx){
        if (lyr==null) return;

      //Add layer to the map
        if (idx!=null) map.getLayers().insertAt(idx, lyr);
        else map.addLayer(lyr);


      //Add custom clear() method directly to the layer
        var src = lyr.getSource();
        if (src instanceof ol.source.Vector){
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
                return this.getSource().getExtent();
            };
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



        if (lyr instanceof ol.layer.Tile){
            lyr.on('precompose', function(event) {
                statusDiv.innerHTML = "Loading...";
                var numTiles = calculateNumberOfTiles(this.getSource());

                if (numTiles!=this.numTiles){
                    this.numTiles=numTiles;
                    this.numTilesLoaded = 0;
                }
            });
            lyr.on('postcompose', function(event) {

                if (this.numTilesLoaded) this.numTilesLoaded+=1;
                else this.numTilesLoaded=1;

                if (this.numTilesLoaded>=this.numTiles){
                    this.numTiles = 0;
                    this.numTilesLoaded = 0;
                    me.onLoad(this);

                    setTimeout(function() {
                        statusDiv.innerHTML = "";
                    }, 1500);
                }
            });
            lyr.refresh = function(){
                var source = this.getSource();
                source.tileCache.expireCache({});
                source.tileCache.clear();
                if (source.clear) source.refresh();
            };
        }

        return lyr;
    };


  //**************************************************************************
  //** getLayers
  //**************************************************************************
  /** Returns an array of layers. Note that layer groups will be represented
   *  as arrays.
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
            var feature = wktFormatter.readFeature(geom);
            geom = feature.getGeometry();
            geom.transform('EPSG:4326', 'EPSG:3857');
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
        layer.getSource().addFeature(new ol.Feature({
            geometry: new ol.geom.Point([-20026376.39, -20048966.10]),
            style: new ol.style.Style({
                fill: new ol.style.Fill({
                    color: ol.color.asString([0,0,0,0])
                })
            })
        }));
        layer.getSource().addFeature(new ol.Feature({
            geometry: new ol.geom.Point([20026376.39, 20048966.10]),
            style: new ol.style.Style({
                fill: new ol.style.Fill({
                    color: ol.color.asString([0,0,0,0])
                })
            })
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

        xCoord.innerHTML = lon;
        yCoord.innerHTML = lat;
    };


    var round = function(value, decimalPlaces){
        return Number(Math.round(parseFloat(value + 'e' + decimalPlaces)) + 'e-' + decimalPlaces);
    };


  //**************************************************************************
  //** JavaXT Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;
    var setStyle = javaxt.dhtml.utils.setStyle;
    var addResizeListener = javaxt.dhtml.utils.addResizeListener;


    init();
};


if(!com) var com={};
if(!com.kartographia) com.kartographia={};
com.kartographia.Map = kartographia.Map;