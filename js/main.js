requirejs.config({
    baseUrl: 'js',
    paths: {
        'paper' : "lib/paper",
        'lodash' : "lib/lodash"
    },
    shim: {
        'paper': {
            exports: 'paper'
        },
        'lodash': {
            exports: '_'
        }
    }
});

require( ["lodash", "paper"],
    function(_, paper, utils) {
        //for this small program simple Module pattern can be used
        //instead of RequireJS. But I'd like to try it.

        //init of PaperJS
        var canvas = document.getElementById('canvas'),
            width = document.documentElement.clientWidth,
            height = document.documentElement.clientHeight;
        paper.setup(canvas);
        paper.view.setViewSize(width, height);
        var tool = new paper.Tool();

        var STAGE_SPROUT = 0,
            STAGE_SEED = 1,
            game = {
                currentSeed: null,
                currentSprout: null,
                newSeedShape: null,
                stage: 0, //0 - STAGE_SPROUT, 1 - STAGE_SEED
                seeds: [],
                sprouts: [],
                moves: 0
            };

        var new_game_button = document.getElementById('new_game');
        new_game_button.onclick = function() {
            playGame(game);
        };

        //preloading info
        var loadingText = new paper.PointText(new paper.Point(width / 2.0, height / 2.0));
        loadingText.fillColor = '#75502b';
        loadingText.justification = 'center';
        loadingText.scale(4);
        loadingText.content = 'Loading...';

        var title_shape,
            title;
        paper.project.importSVG('./assets/sprouts-title.svg', function(item) {
            title_shape = item;
            title_shape.scale(2);
            loadingText.remove();
            loadingText = null;
            title = createTitle(title_shape);
            document.getElementById('menu_container').style.visibility = 'visible';
        });

        //start new game
        function playGame(gm) {
            var seeds_number,
                seed_diameter;

            gm.currentSeed = null;
            gm.currentSprout = null;
            gm.newSeedShape = null;
            gm.stage = 0;
            gm.seeds = [];
            gm.sprouts = [];
            gm.moves = 0;

            paper.project.clear();

            document.getElementById('stats').style.visibility = 'visible';
            document.getElementById('player_id').textContent = 1;
            document.getElementById('moves_count').textContent = 0;

            seeds_number = document.getElementById('seeds_number').value;
            seed_diameter = document.getElementById('seed_diameter').value;

            if (seeds_number > 10) {
                seeds_number = 10;
            } else if (seeds_number < 2) {
                seeds_number = 2;
            }
            document.getElementById('seeds_number').value = seeds_number;

            if (seed_diameter > 50) {
                seed_diameter = 50;
            } else if (seed_diameter < 10) {
                seed_diameter = 10;
            }
            document.getElementById('seed_diameter').value = seed_diameter;

            game.seeds = plantSeeds(seeds_number, seed_diameter, {
                width: paper.view.viewSize.width,
                height: paper.view.viewSize.height
            });

            paper.view.draw();

            return game;
        }

        //create seed (point) with specified position and diameter.
        //return seed object
        function createSeed(coord, diameter) {

            var sproutsCount = 0,
                shape = new paper.Path.Circle({
                    center: coord,
                    radius: diameter / 2.0,
                    fillColor: '#CCCC33',
                    strokeColor: '#CCCC33'
                });

            var me = {
                coord: coord,
                diameter: diameter,
                shape: shape,
                isSprouted: false
            };

            function changeColor(){

                switch (sproutsCount) {
                    case 0:
                        shape.fillColor = '#CCCC33';
                        break;
                    case 1:
                        shape.fillColor = '#CCCC33';
                        break;
                    case 2:
                        shape.fillColor = '#ABBC2D';
                        break;
                    case 3:
                        shape.fillColor = '#488A1C';
                        break;
                    default:
                        shape.fillColor = 'blue';
                        break;
                }
                shape.strokeColor = shape.fillColor;
            }

            me.addSprout = function () {
                sproutsCount += 1;
                if (sproutsCount >= 3) {
                    me.isSprouted = true;
                }
                changeColor();
                return me;
            };

            me.removeSprout = function () {
                sproutsCount -= 1;
                if (sproutsCount < 3) {
                    me.isSprouted = false;
                }
                changeColor();
                return me;
            };

            me.select = function () {
                shape.strokeColor = '#75502B';
                return me;
            };

            me.deselect = function () {
                changeColor();
                return me;
            };

            return me;
        }

        //fill game field with preassumed number of seeds
        function plantSeeds(seeds_number, seed_diameter, field) {
            var seeds = [],
                coord,
                coords = [],
                isIntersected,
                offset = 50;

            for (var i = 0; i < seeds_number; i += 1) {
                isIntersected = true;
                //randomize seed coordinates and check that seeds do not intersect each other
                while (isIntersected) {
                    coord = new paper.Point(_.random(offset, field.width - offset),
                                            _.random(offset, field.height - offset));
                    isIntersected = false;
                    //we can used vanilla for loop or array.forEach instead of lodash. But I used it for convenience.
                    _.forEach(coords, function (s) {
                        if (s.subtract(coord).length < seed_diameter) {
                            isIntersected = true;
                        }
                    })
                }
                coords.push(coord);
            }

            //create seeds at specified coordinates
            _.forEach(coords, function (coord) {
                seeds.push(createSeed(coord, seed_diameter))
            });

            return seeds;
        }

        //this functions checks intersection between sprouts and certain sprout
        //return True of False
        //It is used when sprouts intersections prohibition rule is applied
        function sproutsIntersectionTest(sprouts, sprout) {
            var intersected_sprout = _.find(sprouts, function(s) {
                if (s !== sprout) {
                    return (s.getIntersections(sprout).length);
                }
                return false;
            });
            return !!intersected_sprout;
        }

        //check whether point inside any of provided seeds or not.
        //return seed or undefined
        function pointSeedsHitTest(seeds, point) {
            var seed,
                hit_result;

            seed = _.find(seeds, function(s) {
                hit_result = s.shape.hitTest(point);
                return hit_result;
            });
            return seed;
        }

        function seedsShapeIntersectionTest(seeds, shape) {

            var isSeedsIntersected = false;
            _.forEach(seeds, function (s) {
                if (s.coord.subtract(shape.position).length < s.diameter) {
                    isSeedsIntersected = true;
                }
            });

            return isSeedsIntersected;
        }

        //helper func for mouseHandlers
        function addSeed(gm, event) {
            var seed,
                seeds = gm.seeds,
                new_seed_shape = gm.newSeedShape,
                current_sprout = gm.currentSprout,
                stage = gm.stage,
                moves = gm.moves;

            if (!seedsShapeIntersectionTest(seeds, new_seed_shape)) {
                seed = createSeed(new_seed_shape.position, seeds[0].diameter);
                seed.addSprout();
                seed.addSprout();
                seeds.push(seed);
                new_seed_shape.remove();
                current_sprout = null;
                stage = STAGE_SPROUT;
                moves += 1;
            }

            gm.newSeedShape = new_seed_shape;
            gm.currentSprout = current_sprout;
            gm.stage = stage;
            gm.moves = moves;
        }

        //each mouse event handler has two functions.
        //one for seed selecting stage, second for sprout drawing stage
        var mouseHandlers = {
            onMouseDown: [
                function (gm, event) {
                    var seed,
                        seeds = gm.seeds,
                        current_seed = gm.currentSeed,
                        current_sprout = gm.currentSprout;

                    //click on seed?
                    seed = pointSeedsHitTest(seeds, event.point);

                    //if clicked on seed and seed does not have 3 sprouts (lines) out of it then
                    //select seed and start drawing sprout
                    if (seed && !seed.isSprouted) {
                        /*if (current_seed) {
                            current_seed.deselect()
                        }*/
                        current_seed = seed;
                        current_seed.select();
                        current_seed.addSprout();
                        current_sprout = new paper.Path();
                        current_sprout.strokeColor = game.moves % 2 ? "#8AAB28": "#699B22";
                        current_sprout.strokeWidth = 4;
                    } else {
                        //TODO: ?
                        current_sprout = null;
                    }

                    gm.currentSeed = current_seed;
                    gm.currentSprout = current_sprout;
                },
                function (gm, event) {
                    addSeed(gm, event);
                }
            ],

            onMouseDrag: [
                function (gm, event) {
                    var next_seed,
                        current_sprout = gm.currentSprout,
                        current_seed = gm.currentSeed,
                        sprouts = gm.sprouts,
                        seeds = gm.seeds,
                        stage = gm.stage,
                        new_seed_shape = gm.newSeedShape;

                    function resetMove() {
                        current_seed.removeSprout();
                        current_seed.deselect();
                        current_seed = null;
                        current_sprout.remove();
                        current_sprout = null;
                    }

                    if (current_sprout) {
                        //start draw sprout path only when mouse leaves seed
                        //but sprout can return in the same seed (i.e. looped sprout).
                        //so we should check path length too
                        if (!current_sprout.segments.length && !current_seed.shape.hitTest(event.point)) {
                            current_sprout.add(current_seed.shape.getNearestPoint(event.point));
                        } else if (current_sprout.segments.length) {
                            //draw sprout
                            current_sprout.add(event.point);
                            //if current sprout hit another sprout or itself then remove current sprout
                            if (sproutsIntersectionTest(sprouts, current_sprout) ||
                                current_sprout.getIntersections().length > 0) {
                                resetMove();
                            } else {
                                //if sprout hit seed then check possibility of connection
                                next_seed = pointSeedsHitTest(seeds, event.point);
                                if (next_seed) {
                                    if (next_seed.isSprouted){
                                        //if intersected seed already have 3 sprouts then chancel drawing of current seed
                                        resetMove();
                                    } else {
                                        //if connection with the seed is possible then finish drawing and change stage to seed planting
                                        current_sprout.simplify(10);
                                        sprouts.push(current_sprout);
                                        next_seed.addSprout();
                                        stage = STAGE_SEED;
                                        new_seed_shape = new paper.Shape.Circle({
                                                center: event.point,
                                                radius: seeds[0].diameter / 2.0,
                                                strokeColor: 'gray',
                                                strokeWidth: 2,
                                                dashArray: [2, 3]
                                            }
                                        );
                                        next_seed.shape.bringToFront();
                                        current_seed.shape.bringToFront();
                                        current_seed.deselect();
                                        current_seed = null;
                                    }
                                }
                            }
                        }
                    }

                    gm.currentSprout = current_sprout;
                    gm.currentSeed = current_seed;
                    gm.stage = stage;
                    gm.newSeedShape = new_seed_shape;
                },
                function (gm, event) {
                    var new_seed_shape = gm.newSeedShape,
                        current_sprout = gm.currentSprout,
                        seeds = gm.seeds;
                    new_seed_shape.position = current_sprout.getNearestPoint(event.point);
                    if (!seedsShapeIntersectionTest(seeds, new_seed_shape)) {
                        new_seed_shape.strokeColor = '#75502B';
                    } else {
                        new_seed_shape.strokeColor = 'red';
                    }
                }
            ],

            onMouseMove: [
                function (event) {

                },
                function (gm, event) {
                    var new_seed_shape = gm.newSeedShape,
                        current_sprout = gm.currentSprout,
                        seeds = gm.seeds;

                    //new seed can be planted only without intersection with others seeds
                    new_seed_shape.position = current_sprout.getNearestPoint(event.point);
                    if (!seedsShapeIntersectionTest(seeds, new_seed_shape)) {
                        new_seed_shape.strokeColor = '#75502B';
                    } else {
                        new_seed_shape.strokeColor = 'red';
                    }
                }
            ],

            onMouseUp: [
                function (gm, event) {
                    var current_sprout = gm.currentSprout,
                        current_seed = gm.currentSeed;

                    //clear up globals
                    if (current_sprout) {
                        current_seed.removeSprout();
                        current_seed.deselect();
                        current_seed = null;
                        current_sprout.remove();
                        current_sprout = null;
                    }

                    gm.currentSprout = current_sprout;
                    gm.currentSeed = current_seed;
                },
                function (event) {
                    addSeed(game, event);
                }
            ]
        };

        tool.onMouseDown = function(event) {
            mouseHandlers.onMouseDown[game.stage](game, event);
        };

        tool.onMouseDrag = function(event) {
            mouseHandlers.onMouseDrag[game.stage](game, event);
        };

        tool.onMouseMove = function(event) {
            mouseHandlers.onMouseMove[game.stage](game, event);
        };

        tool.onMouseUp = function(event) {
            mouseHandlers.onMouseUp[game.stage](game, event);
        };

        function createTitle(title_shape){
            var me = {
                shape: title_shape
            };

            me.adjust = function() {
                var width = paper.view.viewSize.width,
                    height = paper.view.viewSize.height;
                me.shape.position = new paper.Point(width / 2.0, height / 2.0);
            };

            me.adjust();

            return me;
        }

        paper.view.onResize = function(event) {
            var width = document.documentElement.clientWidth,
                height = document.documentElement.clientHeight;

            paper.view.setViewSize(width, height);
            paper.view.draw();

            // whenever the view is resized, move the title to its center:
            if (title) {
                title.adjust();
            }
        };

        //if moves counter changed that switch players
        paper.view.onFrame = (function() {
            var moves = 0;
            return function (event) {
                if (moves !== game.moves) {
                    document.getElementById('player_id').textContent = (game.moves % 2 + 1);
                    document.getElementById('moves_count').textContent = game.moves;
                    moves = game.moves;
                }
            }
        })();

    });
