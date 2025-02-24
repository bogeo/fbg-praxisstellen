var mapContainerNodeId = "mapContainer";
var linkToJsonFile = "./kontakte.geojson";
var useCluster = true;
var clusterToggleSwitchId = "clusterToggleSwitch";

const study_surveilling = "Vermessung";
const study_geoinformatics = "Geoinformatik";
const property_company = "Firma";
const moodlePageId = "moodlePageId";
const moodlePageId_label = "Weitere Informationen";
const moodlePageId_baseUrl = "https://moodle.hs-bochum.de/mod/page/view.php?id=";
const property_postcode = "PLZ";
const property_street = "Straße";
const property_city = "Ort";
const property_address = "Adresse";

const style_class_surveilling = "blue"; // red, green, blue
const style_class_geoinformatics = "green"; // red, green, blue
const style_class_careerDay = "red"; // red, green, blue

const label_layer_surveilling = "Praxisstellen - Studiengang Vermessung " + "<i class='icon icon-" + style_class_surveilling + "'></i>";
const label_layer_geoinformatics = "Praxisstellen - Studiengang Geoinformatik " + "<i class='icon icon-" + style_class_geoinformatics + "'></i>";
const label_layer_careerDay = "Praxisstellen - Career Day " + "<i class='icon icon-" + style_class_careerDay + "'></i>";

var overlayLayersArray = [];

var map;
var layerControl;
var searchControl;

const MultipleResultsLeafletSearch = L.Control.Search.extend({

    _makeUniqueKey: function (featureName) {
        return featureName;
    },

    _searchInLayer: function (layer, retRecords, propName) {
        var self = this, loc;
        var key_withUniqueID;

        if (layer instanceof L.Control.Search.Marker) return;

        if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
            if (self._getPath(layer.options, propName)) {
                loc = layer.getLatLng();
                loc.layer = layer;
                retRecords[self._getPath(layer.options, propName)] = loc;
            }
            else if (self._getPath(layer.feature.properties, propName)) {
                loc = layer.getLatLng();
                loc.layer = layer;
                key_withUniqueID = this._makeUniqueKey(self._getPath(layer.feature.properties, propName));
                retRecords[key_withUniqueID] = loc;
            }
            else {
                //throw new Error("propertyName '"+propName+"' not found in marker");
                console.warn("propertyName '" + propName + "' not found in marker");
            }
        }
        else if (layer instanceof L.Path || layer instanceof L.Polyline || layer instanceof L.Polygon) {
            if (self._getPath(layer.options, propName)) {
                loc = layer.getBounds().getCenter();
                loc.layer = layer;
                retRecords[self._getPath(layer.options, propName)] = loc;
            }
            else if (self._getPath(layer.feature.properties, propName)) {
                loc = layer.getBounds().getCenter();
                loc.layer = layer;
                key_withUniqueID = this._makeUniqueKey(self._getPath(layer.feature.properties, propName));
                retRecords[key_withUniqueID] = loc;
            }
            else {
                //throw new Error("propertyName '"+propName+"' not found in shape");
                console.warn("propertyName '" + propName + "' not found in shape");
            }
        }
        else if (layer.hasOwnProperty('feature'))//GeoJSON
        {
            if (layer.feature.properties.hasOwnProperty(propName)) {

                key_withUniqueID = this._makeUniqueKey(self._getPath(layer.feature.properties, propName));
                if (layer.getLatLng && typeof layer.getLatLng === 'function') {
                    loc = layer.getLatLng();
                    loc.layer = layer;
                    retRecords[key_withUniqueID] = loc;
                } else if (layer.getBounds && typeof layer.getBounds === 'function') {
                    loc = layer.getBounds().getCenter();
                    loc.layer = layer;
                    retRecords[key_withUniqueID] = loc;
                } else {
                    console.warn("Unknown type of Layer");
                }
            }
            else {
                //throw new Error("propertyName '"+propName+"' not found in feature");
                console.warn("propertyName '" + propName + "' not found in feature");
            }
        }
        else if (layer instanceof L.LayerGroup) {
            layer.eachLayer(function (layer) {
                self._searchInLayer(layer, retRecords, propName);
            });
        }
    },
    _defaultMoveToLocation: function (latlng, title, map) {
        if (this.options.zoom)
            this._map.setView(latlng, this.options.zoom);
        else
            this._map.panTo(latlng);

        // add collapse after click on item
        this.collapse();
    },
    _handleAutoresize: function () {
        var maxWidth;

        if (!this._map) {
            this._map = map;
        }

        if (this._input.style.maxWidth !== this._map._container.offsetWidth) {
            maxWidth = this._map._container.clientWidth;

            // other side margin + padding + width border + width search-button + width search-cancel
            maxWidth -= 10 + 20 + 1 + 30 + 22;

            this._input.style.maxWidth = maxWidth.toString() + 'px';
        }

        if (this.options.autoResize && (this._container.offsetWidth + 20 < this._map._container.offsetWidth)) {
            this._input.size = this._input.value.length < this._inputMinSize ? this._inputMinSize : this._input.value.length;
        }
    }
});

function updateSearchControl() {

    setTimeout(function () {
        if (searchControl) {
            try {
                map.removeControl(searchControl);
                searchControl = undefined;
            }
            catch (error) {
                console.error(error);
            }
        }

        // build L.layerGroup of available POI layers
        var featureLayers = [];

        for (var layerEntry of layerControl._layers) {
            if (layerEntry) {
                if (layerEntry.overlay) {
                    if (map.hasLayer(layerEntry.layer)) {
                        featureLayers.push(layerEntry.layer);
                    }

                }
            }
        }

        var layerGroup;
        // if no relevant layers are currently displayed, then
        if (featureLayers.length === 0) {
            searchControl = new MultipleResultsLeafletSearch({
            });
            searchControl.addTo(map);
        }
        else {
            layerGroup = L.featureGroup(featureLayers);

            searchControl = new MultipleResultsLeafletSearch({
                position: "topleft",
                layer: layerGroup,
                initial: false,
                propertyName: property_company,
                textPlaceholder: "Firmen nach Name und Eigenschaften filtern",
                textCancel: "Abbrechen",
                textErr: "Position nicht gefunden",
                hideMarkerOnCollapse: true,
                zoom: 15,
                autoResize: true,
                autoCollapse: false,
                autoType: true,
                formatData: function (json) {	//adds coordinates to name.
                    var propName = this.options.propertyName,
                        propLoc = this.options.propertyLoc,
                        i, jsonret = {};
                    if (L.Util.isArray(propLoc))
                        for (i in json) {
                            if (!this._getPath(json[i], propName)) continue;
                            jsonret[this._getPath(json[i], propName) + " (" + json[i][propLoc[0]] + "," + json[i][propLoc[1]] + ")"] = L.latLng(json[i][propLoc[0]], json[i][propLoc[1]]);
                        }
                    else
                        for (i in json) {
                            if (!this._getPath(json[i], propName)) continue;
                            jsonret[this._getPath(json[i], propName) + " (" + json[i][propLoc][0] + "," + json[i][propLoc][1] + ")"] = L.latLng(this._getPath(json[i], propLoc));
                        }
                    return jsonret;
                },
                filterData: function (text, records) {
                    var I, icase, regSearch, frecords = {};

                    text = text.replace(/[.*+?^${}()|[\]\\]/g, '');  //sanitize remove all special characters
                    if (text === '')
                        return [];

                    I = this.options.initial ? '^' : '';  //search only initial text
                    icase = !this.options.casesensitive ? 'i' : undefined;

                    regSearch = new RegExp(I + text, icase);

                    for (var key in records) {

                        // make a searchable string from all relevant feature properties
                        let recordString = "";
                        let record = records[key];
                        let recordProperties = record.layer.feature.properties;

                        for (const propertyKey in recordProperties) {
                            if (recordProperties[propertyKey]) {
                                recordString += recordProperties[propertyKey];
                            }
                        }

                        if (regSearch.test(recordString))
                            frecords[key] = records[key];
                    }

                    return frecords;
                },
                buildTip: function (text, val) {
                    var emString = "";

                    if (val.layer.feature) {
                        if (val.layer.styleClass) {
                            emString += '<i style="width:14px;height:14px;float:left;" class="icon icon-' + val.layer.styleClass + '">';
                            emString += '</i>';
                        }
                    }
                    else {
                        emString += "<i style='font-size:1.0em;' class='fas fa-sitemap'></i>";
                    }
                    return '<a href="" class="search-tip">' + emString + '&nbsp;&nbsp;' + text + '</a>';
                }
            });

            searchControl.addTo(map);
        }
    }, 200);
};

function initControls() {

    if (map) {
        // zoom control as default

        // attribution control - static suffix
        map.attributionControl.addAttribution("Hochschule Bochum");

        // scale control
        L.control.scale(
            { maxWidth: 500, metric: true, imperial: false }
        ).addTo(map);

        // layerControl
        var baseLayers = {};
        var overlayLayers = {};
        layerControl = L.control.layers(baseLayers, overlayLayers);
        layerControl.addTo(map);

        /////////////////////////////////////////////////////
        ///// LEAFLET SEARCH SETUP
        /////////////////////////////////////////////////////
        // will be updated once example indicator layer is loaded
        searchControl = new MultipleResultsLeafletSearch({
        });
        searchControl.addTo(map);
    }

}

function initBackgroundLayers() {

    if (map && layerControl) {
        // specify all background WMS layers
        // only OSM as active layer

        // start layer

        var osmLayer_tiled =
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                { attribution: 'OSMTiles' }).addTo(map);

        // add baseLayers to Base Layers in layer control
        layerControl.addBaseLayer(osmLayer_tiled, "Open Street Map");
    }
}

function onEachFeature(feature, layer) {
    if (feature.properties) {
        let html = "<div class='table-responsive'><table class='table table-striped table-sm'>";

        html += "<thead>"

        html += "<tr>";
        html += "<th><b>Attributname</b></th>"
        html += "<th><b>Wert</b></th>"
        html += "</tr>";

        html += "</thead>"
        html += "<tbody>"

        for (const key in feature.properties) {
            if (Object.hasOwnProperty.call(feature.properties, key)) {
                const element = feature.properties[key];
                html += "<tr>";
                html += "<td>" + key + "</td>"
                html += "<td>" + element + "</td>"
                html += "</tr>";
            }
        }

        html += "</tbody>"
        html += "</table></div>";

        layer.bindPopup(html);
    }
    else {
        layer.bindPopup("No properties found");
    }
}

function pointToLayer(feature, latlng, styleClass) {

    const fontAwesomeIcon = L.divIcon({
        html: '<i class="fa-solid fa-location-dot fa-2xl"></i>',
        iconSize: [20, 20],
        className: styleClass
    });

    let marker = L.marker(latlng, { icon: fontAwesomeIcon })
    marker.feature = feature;
    marker.styleClass = styleClass;

    return marker;
};

var addPoiMarker = function (markers, poiMarker) {

    // var propertiesString = "<pre>" + JSON.stringify(poiMarker.feature.properties, null, ' ').replace(/[\{\}"]/g, '') + "</pre>";

    let company_name = poiMarker.feature.properties[property_company];
    // delete poiMarker.feature.properties[property_company];

    let street = poiMarker.feature.properties[property_street];
    delete poiMarker.feature.properties[property_street];

    let city = poiMarker.feature.properties[property_city];
    delete poiMarker.feature.properties[property_city];

    let postcode = poiMarker.feature.properties[property_postcode];
    delete poiMarker.feature.properties[property_postcode];

    let adressValue = street + ", " + postcode + ", " + city;
    poiMarker.feature.properties[property_address] = adressValue;

    let moodlePageIdValue = poiMarker.feature[moodlePageId];
    if (moodlePageIdValue && moodlePageIdValue != "") {
        poiMarker.feature.properties[moodlePageId_label] = "<a target='_blank' rel='noreferrer noopener' href=" + moodlePageId_baseUrl + moodlePageIdValue + ">" + moodlePageId_baseUrl + moodlePageIdValue + "</a>";
    }

    var popupContent = '<div class="featurePropertyPopupContent"><table class="table table-condensed">';
    for (var p in poiMarker.feature.properties) {
        popupContent += '<tr><td><b>' + p + '</b></td><td>' + poiMarker.feature.properties[p] + '</td></tr>';
    }
    popupContent += '</table></div>';

    poiMarker.bindPopup("<b><i>" + company_name + "</i></b>" + "<br><br>" + popupContent);

    markers.addLayer(poiMarker);

    return markers;
};

function addLeafletOverlay(geoJSON, title, styleClass) {
    if (map && layerControl) {


        var markers;
        if (useCluster) {
            markers = L.markerClusterGroup({
                iconCreateFunction: function (cluster) {
                    var childCount = cluster.getChildCount();

                    var c = 'marker-cluster-';
                    if (childCount < 5) {
                        c += 'small';
                    } else if (childCount < 10) {
                        c += 'medium';
                    } else {
                        c += 'large';
                    }

                    var className = "marker-cluster " + c + " bg-" + styleClass;

                    //'marker-cluster' + c + ' ' +
                    return new L.DivIcon({ html: '<div class="bg-' + styleClass + '" ><span>' + childCount + '</span></div>', className: className, iconSize: new L.Point(40, 40) });
                }
            });
        }
        else {
            markers = L.layerGroup();
        }

        geoJSON.features.forEach(function (poiFeature) {
            // index 0 should be longitude and index 1 should be latitude
            //.bindPopup( poiFeature.properties.name )
            let latLng = [poiFeature.geometry.coordinates[1], poiFeature.geometry.coordinates[0]];
            var newMarker = pointToLayer(poiFeature, latLng, styleClass)

            markers = addPoiMarker(markers, newMarker);
        });

        markers.addTo(map);
        layerControl.addOverlay(markers, title);
        overlayLayersArray.push(markers);
    }
}


function loadLayers(geoJSON) {

    fetch(linkToJsonFile)
    .then((response) => {
      return response.json();
    })
    .then((geoJSON) => {
        let geoJSON_surveilling = JSON.parse(JSON.stringify(geoJSON));
        let geoJSON_geoinformatics = JSON.parse(JSON.stringify(geoJSON));
        let geoJSON_careerDay = JSON.parse(JSON.stringify(geoJSON));

        // study is an array. so multiple studies may be specified
        // hence query the array if it includes the respective array
        let features_surveilling = geoJSON_surveilling.features.filter(feature => feature.label.study.includes(study_surveilling));
        let features_geoinformatics = geoJSON_geoinformatics.features.filter(feature => feature.label.study.includes(study_geoinformatics));
        let features_careerDay = geoJSON_careerDay.features.filter(feature => feature[moodlePageId] && feature[moodlePageId] != "");

        geoJSON_surveilling.features = features_surveilling;
        geoJSON_geoinformatics.features = features_geoinformatics;
        geoJSON_careerDay.features = features_careerDay;

        if (features_surveilling.length > 0) {
            addLeafletOverlay(geoJSON_surveilling, label_layer_surveilling, style_class_surveilling);
        }
        if (features_geoinformatics.length > 0) {
            addLeafletOverlay(geoJSON_geoinformatics, label_layer_geoinformatics, style_class_geoinformatics);
        }
        if (features_careerDay.length > 0) {
            addLeafletOverlay(geoJSON_careerDay, label_layer_careerDay, style_class_careerDay);
        }
    })


}

function clearOverlays() {
    for (const layer of overlayLayersArray) {
        layerControl.removeLayer(layer);
        map.removeLayer(layer);
    }
}

function initOverlays() {
    if (map && layerControl) {
        // specify all overlay layers

        clearOverlays();

        loadLayers(geoJSON);

    }
}

function initMap() {
    // map = L.map(mapContainerNodeId).setView([51.461372, 7.2418863], 6);
    map = L.map(mapContainerNodeId).setView([51.3149725, 9.3905754], 6);

    initControls();

    initBackgroundLayers();

    initOverlays();

    updateSearchControl();
}

function toggleClusterDisplay(event) {
    let clusterSwitch = document.getElementById(clusterToggleSwitchId);

    if (clusterSwitch.checked === true || clusterSwitch.checked === 'checked') {
        useCluster = true;
    }
    else {
        useCluster = false;
    }

    initOverlays();
}

function initClusterSwitch() {
    let clusterSwitch = document.getElementById(clusterToggleSwitchId);
    clusterSwitch.checked = true;
    clusterSwitch.checked = "checked";

    clusterSwitch.addEventListener("change", toggleClusterDisplay);
}

function onDomLoaded() {
    initMap();

    initClusterSwitch();
}

initMap();

initClusterSwitch();

// document.addEventListener("DOMContentLoaded", onDomLoaded);