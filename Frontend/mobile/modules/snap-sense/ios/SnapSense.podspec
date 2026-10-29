Pod::Spec.new do |s|
  s.name           = 'SnapSense'
  s.version        = '1.0.0'
  s.summary        = 'On-device checks of a snapped photo, and a first read of the item in it'
  s.description    = 'Measures a photo with Vision before it is sent to be priced, and reads the item with Apple Intelligence where the device has it.'
  s.author         = 'SnapWorth'
  s.homepage       = 'https://github.com/clark2405/SnapWorth'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'Vision', 'ImageIO', 'CoreGraphics'
  # Apple Intelligence's framework exists only from iOS 26, and the app runs from 16.4: linked
  # weakly, an older iPhone launches and simply has no item reader.
  s.weak_frameworks = 'FoundationModels'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
