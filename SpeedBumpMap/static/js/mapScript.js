
function stretchMap() {
    $("#mainMap").width($("html").width())
    $("#mainMap").height($("html").height())
}

function MoscowMap(id) {
    return new ymaps.Map(
        id,
        {
            center: [55.76, 37.64],
            zoom: 10,
            controls: []
        },
        {
            restrictMapArea : true
        }
    );
}

function addSpeedBumpView(map) {
    $.get(
        '/SpeedBumps',
        function(data) {
            bumpCollection = new ymaps.GeoObjectCollection();
            for (speedbump in data) {
                mark = new ymaps.Placemark(data[speedbump].coordinates, {
                    balloonContent: data[speedbump].street,
                    id : speedbump
                }, {
                    preset: 'islands#circleIcon'
                });
                mark.events.add('click', function(e){
                    $.get(
                        '/CarPaths?id=' + e.get('target').properties.get('id'),
                        function(routeData) {
                            for (c in routeData) {
                                car = routeData[c];
                                for (r = 0; r < car.touches.length - 1; r += 1){
                                    console.log(car.touches[r].id);
                                    console.log(car.touches[r + 1].id);
                                    ymaps.route([
                                        data[parseInt(car.touches[r].id)].coordinates,
                                        data[parseInt(car.touches[r + 1].id)].coordinates,
                                    ]).done(function(route) {
                                        map.geoObjects.add(route);
                                    });
                                }
                            }
                        }
                    )
                });
                bumpCollection.add(mark);
            }
            map.geoObjects.add(bumpCollection);
        }
    )
}

function addCarCountView(map) {
    $.get(
        '/CarCount',
        function(data) {
            countCollection = new ymaps.GeoObjectCollection();
            for (c in data) {
                countCollection.add(
                    new ymaps.Placemark(data[c].coordinates, {
                        iconContent : data[c].count,
                        balloonContent : "<b>Количество проехавших машин</b>: " + data[c].count +
                                         "<br><b>Суммарная масса</b>: " + data[c].summaryWeight + " (тонн)<br><hr>" +
                                         "Количество легковых: " + data[c].classes['light-weighted'] + "<br>" +
                                         "Количество средних: " + data[c].classes['average-weighted'] + "<br>" +
                                         "Количество тяжёлых: " + data[c].classes['heavy-weighted']
                    }, {
                        preset : "islands#redCircleIcon"
                    })
                )
            }
            map.geoObjects.add(countCollection);
        }
    )
}

function addHeatmapView(map) {
    ymaps.modules.require(['Heatmap'], function(Heatmap) {
        $.get(
            '/StreetDensity',
            function(data) {
                var featuresData = []
                for (i in data) {
                    featuresData.push(
                        {
                            id:'id' + i,
                            type:'Feature',
                            geometry: {
                                type:'Point',
                                coordinates: data[i].coordinates
                            },
                            properties: {
                                weight: data[i].density
                            }
                        }
                    );
                }
                var heatmap = new Heatmap({type:'FeatureCollection', features : featuresData}, {
                    gradient: {
                        0.1: 'rgba(128, 255, 0, 0.7)',
                        0.4: 'rgba(255, 255, 0, 0.8)',
                        0.6: 'rgba(234, 72, 58, 0.9)',
                        1.0: 'rgba(0, 0, 0, 1)'
                    }
                });
                heatmap.setMap(map);
                $('button').click(function(){
                    heatmap.destroy();
                })
            }
        )
    })
}

function addRealTimeView(map) {
    ymaps.modules.require(['Heatmap'], function(Heatmap) {
        $.get(
            '/TimeSorted',
            function(data) {
                var weightDict = {}, featuresData = {type:'FeatureCollection', features : []};
                var heatmap = new Heatmap(featuresData, {
                    gradient: {
                        0.1: 'rgba(128, 255, 0, 0.7)',
                        0.7: 'rgba(255, 255, 0, 0.8)',
                        0.9: 'rgba(234, 72, 58, 0.9)',
                        1.0: 'rgba(0, 0, 0, 1)'
                    }
                });
                heatmap.setMap(map);
                var i = 0, step = parseInt(data.length / 2000);
                addInterval = setInterval(function() {
                    console.log(i);
                    for (j = i; j < Math.min(i + step, data.length); j += 1) {
                        if (!(data[j].ID in weightDict)) {
                            featuresData.features.push(
                                {
                                    id:'id' + j,
                                    type:'Feature',
                                    geometry: {
                                        type:'Point',
                                        coordinates: data[j].coordinates
                                    },
                                    properties: {
                                        weight: data[j].density
                                    }
                                }
                            );
                            weightDict[data[j].ID] = featuresData.features.length - 1;
                        }
                        else {
                            featuresData.features[weightDict[data[j].ID]].properties.weight += data[j].weight;
                        }
                    }
                    heatmap.setData(featuresData);
                    $("#heatmapTime").text((new Date(data[i].time * 1000)).toTimeString().split(' ')[0]);
                    i += step;
                    if (i >= data.length) {
                        featuresData = {type:'FeatureCollection', features : []};
                        heatmap.setData(featuresData);
                        weightDict = {};
                        i = 0;
                    }
                }, 400);
                $('button').click(function(){
                    heatmap.destroy();
                    clearInterval(addInterval);
                    $("#heatmapTime").text("");
                })
            }
        )
    })
}

function headerAlign() {
    headerJ = $('#header');
    headerJ.children().css('display', 'block');
    headerJ.children().css('width', 100/headerJ.children().length + '%');
}

function switchViewCallback(map, view_func_add) {
    return function() {
        map.geoObjects.removeAll();
        view_func_add(map);
    }
}

function setupPage() {
    stretchMap();
    headerAlign();
    $("#header").prop('hidden', false);
    $(window).resize(stretchMap);
    $(window).resize(headerAlign);
    ymaps.ready(function() {
        var map = MoscowMap("mainMap");
        addSpeedBumpView(map);
        $("#speedbump-button").click(switchViewCallback(map, addSpeedBumpView));
        $("#carcount-button").click(switchViewCallback(map, addCarCountView));
        $("#heatmap-button").click(switchViewCallback(map, addHeatmapView));
        $("#realtime-button").click(switchViewCallback(map, addRealTimeView));
    });
}
