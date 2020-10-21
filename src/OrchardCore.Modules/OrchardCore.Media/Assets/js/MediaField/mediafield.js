function initializeMediaField(el, modalBodyElement, mediaItemUrl, allowMultiple, allowMediaText, allowCenterCropping) {

    var target = $(document.getElementById($(el).data('for')));
    var initialPaths = target.data("init");

    var mediaFieldEditor = $(el);
    var idprefix = mediaFieldEditor.attr("id");
    var mediaFieldApp;

    mediaFieldApps.push(mediaFieldApp = new Vue({
        el: mediaFieldEditor.get(0),
        data: {
            mediaItems: [],
            selectedMedia: null,
            smallThumbs: false,
            idPrefix: idprefix,
            initialized: false,
            allowMediaText: allowMediaText,
            backupMediaText: '',
            allowCenterCropping: allowCenterCropping,
            backupCenter: [ null, null ]
        },
        created: function () {
            var self = this;

            self.currentPrefs = JSON.parse(localStorage.getItem('mediaFieldPrefs'));
        },
        computed: {
            paths: {
                get: function () {
                    var mediaPaths = [];
                    if (!this.initialized) {
                        return JSON.stringify(initialPaths);
                    }
                    this.mediaItems.forEach(function (x) {
                        if (x.mediaPath === 'not-found') {
                            return;
                        }
                        mediaPaths.push({ path: x.mediaPath, mediaText: x.mediaText, center: x.center });
                    });
                    return JSON.stringify(mediaPaths);
                },
                set: function (values) {
                    var self = this;
                    var mediaPaths = values || [];
                    var signal = $.Deferred();
                    var items = [];
                    var length = 0;
                    mediaPaths.forEach(function (x, i) {
                        items.push({ name: ' ' + x.path, mime: '', mediaPath: '' }); // don't remove the space. Something different is needed or it wont react when the real name arrives.
                        promise = $.when(signal).done(function () {
                            $.ajax({
                                url: mediaItemUrl + "?path=" + encodeURIComponent(x.path),
                                method: 'GET',
                                success: function (data) {
                                    data.vuekey = data.name + i.toString();
                                    data.mediaText = x.mediaText; // This value is not returned from the ajax call.
                                    data.center = x.center; // This value is not returned from the ajax call.
                                    items.splice(i, 1, data);
                                    if (items.length === ++length) {
                                        items.forEach(function (y) {
                                            self.mediaItems.push(y);
                                        });
                                        self.initialized = true;
                                    }
                                },
                                error: function (error) {
                                    console.log(error);
                                    items.splice(i, 1, { name: x.path, mime: '', mediaPath: 'not-found', mediaText: '', center: [ null, null ] });
                                    if (items.length === ++length) {
                                        items.forEach(function (x) {
                                            self.mediaItems.push(x);
                                        });
                                        self.initialized = true;
                                    }
                                }
                            });
                        });
                    });

                    signal.resolve();
                }
            },
            fileSize: function () {
                return Math.round(this.selectedMedia.size / 1024);
            },
            canAddMedia: function () {
                return this.mediaItems.length === 0 || this.mediaItems.length > 0 && allowMultiple;
            },
            thumbSize: function () {
                return this.smallThumbs ? 120 : 240;
            },
            currentPrefs: {
                get: function () {
                    return {
                        smallThumbs: this.smallThumbs
                    };
                },
                set: function (newPrefs) {
                    if (!newPrefs) {
                        return;
                    }
                    this.smallThumbs = newPrefs.smallThumbs;
                }
            },
        },
        mounted: function () {
            var self = this;

            self.paths = initialPaths;

            self.$on('selectAndDeleteMediaRequested', function (media) {
                self.selectAndDeleteMedia(media);
            });

            self.$on('selectMediaRequested', function (media) {
                self.selectMedia(media);
            });

            self.$on('filesUploaded', function (files) {
                self.addMediaFiles(files);
            });
        },
        methods: {
            selectMedia: function (media) {
                this.selectedMedia = media;
            },
            showModal: function (event) {
                var self = this;
                if (self.canAddMedia) {
                    $("#mediaApp").detach().appendTo($(modalBodyElement).find('.modal-body'));
                    $("#mediaApp").show();
                    var modal = $(modalBodyElement).modal();
                    $(modalBodyElement).find('.mediaFieldSelectButton').off('click').on('click', function (v) {
                        self.addMediaFiles(mediaApp.selectedMedias);

                        // we don't want the included medias to be still selected the next time we open the modal.
                        mediaApp.selectedMedias = [];

                        modal.modal('hide');
                        return true;
                    });
                }
            },
            showMediaTextModal: function (event) {
                $(this.$refs.mediaTextModal).modal();
                this.backupMediaText = this.selectedMedia.mediaText;
            },
            cancelMediaTextModal: function (event) {
                $(this.$refs.mediaTextModal).modal('hide');
                this.selectedMedia.mediaText = this.backupMediaText;
            },
            showCenterCroppingModal: function (event) {
                $(this.$refs.centerCroppingModal).modal();
                // Cause a refresh to recalc heights.
                this.$set(this.selectedMedia.center, 0, this.selectedMedia.center[0]);
                this.$set(this.selectedMedia.center, 1, this.selectedMedia.center[1]);
                this.backupCenter = this.selectedMedia.center;
            },            
            cancelCenterCroppingModal: function (event) {
                $(this.$refs.centerCroppingModal).modal('hide');
                this.selectedMedia.center = this.backupCenter;
            },            
            clearCenterCrop: function (event) {
                this.$set(this.selectedMedia.center, 0, null);
                this.$set(this.selectedMedia.center, 1, null);
            },  
            onCropDrop: function(event) {
                var image = this.$refs.cropImage;

                this.$set(this.selectedMedia.center, 0, event.offsetX / image.clientWidth);
                this.$set(this.selectedMedia.center, 1, event.offsetY / image.clientHeight);
            },
            cropLeft: function () {
                if (this.$refs.cropImage && this.$refs.modalBody && this.selectedMedia) {
                    // When image is shrunk compare against the modal body.
                    var offset = (this.$refs.modalBody.clientWidth - this.$refs.cropImage.clientWidth) / 2;
                    var position = (this.selectedMedia.center[0] * this.$refs.cropImage.clientWidth) + offset;
                    if (position < 17) { // Adjust so the target doesn't show outside image.
                        position = 17;
                    } else {
                        position = position - 8; // Adjust to hit the mouse pointer.
                    }
                    return position + 'px';
                } else {
                    return '0';
                }
            },            
            cropTop: function () {
                if (this.$refs.cropImage && this.selectedMedia) {
                    var position = this.selectedMedia.center[1] * this.$refs.cropImage.clientHeight;
                    if (position < 15) { // Adjustment so the target doesn't show outside image.
                        position = 15;
                    } else {
                        position = position + 5; // Adjust to hit the mouse pointer.
                    }
                    return position + 'px';
                } else {
                    return '0';
                }
            },
            setCrop: function (event) {
                var image = this.$refs.cropImage;
                this.$set(this.selectedMedia.center, 0, event.offsetX / image.clientWidth);
                this.$set(this.selectedMedia.center, 1, event.offsetY / image.clientHeight);
            },         
            addMediaFiles: function (files) {
                if ((files.length > 1) && (allowMultiple === false)) {
                    alert($('#onlyOneItemMessage').val());
                    mediaFieldApp.mediaItems.push(files[0]);
                    mediaFieldApp.initialized = true;
                } else {
                    mediaFieldApp.mediaItems = mediaFieldApp.mediaItems.concat(files);
                    mediaFieldApp.initialized = true;
                }
            },
            removeSelected: function (event) {
                if (this.selectedMedia) {
                    var index = this.mediaItems && this.mediaItems.indexOf(this.selectedMedia);
                    if (index > -1) {
                        this.mediaItems.splice(index, 1);
                    }
                }
                else {
                    // The remove button can also remove a unique media item
                    if (this.mediaItems.length === 1) {
                        this.mediaItems.splice(0, 1);
                    }
                }
                this.selectedMedia = null;
            },
            selectAndDeleteMedia: function (media) {
                var self = this;
                self.selectedMedia = media;
                // setTimeout because sometimes 
                // removeSelected was called even before the media was set.
                setTimeout(function () {
                    self.removeSelected();
                }, 100);
            }
        },
        watch: {
            mediaItems: {
                deep: true,
                handler () {
                    // Trigger preview rendering
                    setTimeout(function () { $(document).trigger('contentpreview:render'); }, 100); 
                }
            },            
            currentPrefs: function (newPrefs) {
                localStorage.setItem('mediaFieldPrefs', JSON.stringify(newPrefs));
            }
        }
    }));
}